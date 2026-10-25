// Roles y alcance con MySQL real. No contacta Gemini ni Gmail.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
const base = "http://127.0.0.1:3002/api",
  suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex");
const users = [],
  ids = [];
let child;
async function req(cookie, path, method = "GET", body) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function account(role) {
  const email = `${role}-${users.length}-${suffix}@example.com`;
  const [u] = await db.execute(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    [role + " prueba", email, await bcrypt.hash(password, 12), role],
  );
  users.push(u.insertId);
  const login = await req(null, "/login", "POST", { email, password });
  assert.equal(login.status, 200);
  return {
    id: u.insertId,
    cookie: login.headers.get("set-cookie").split(";")[0],
  };
}
async function make(lawyer) {
  const [r] = await db.execute(
    "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status,lawyer_id) VALUES (?,?,?,?,?,'Laboral','classified',?)",
    [
      "Cliente roles",
      "12345678",
      suffix + "@example.com",
      "999999999",
      "Consulta ficticia para validar permisos.",
      lawyer,
    ],
  );
  ids.push(r.insertId);
  return r.insertId;
}
try {
  child = spawn(process.execPath, ["src/index.js"], {
    env: {
      ...process.env,
      PORT: "3002",
      GEMINI_API_KEY: "",
      MAIL_MODE: "preview",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (child.exitCode !== null) throw new Error("API no inició");
    try {
      if ((await req(null, "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready);
  const manager = await account("gerencia"),
    support = await account("soporte"),
    lawyer = await account("abogado"),
    other = await account("abogado");
  const own = await make(lawyer.id),
    foreign = await make(other.id),
    unassigned = await make(null);
  await db.execute(
    "INSERT INTO documents (case_id,original_name,mime_type,page_count,content,analysis_status,failure_reason) VALUES (?,'prueba.pdf','application/pdf',1,?,'unavailable','missing_key')",
    [foreign, Buffer.from("test")],
  );
  const [docs] = await db.execute("SELECT id FROM documents WHERE case_id=?", [
    foreign,
  ]);
  assert.equal((await req(null, "/cases")).status, 401);
  assert.equal((await req(support.cookie, "/team")).status, 403);
  assert.equal((await req(lawyer.cookie, "/team")).status, 403);
  const listed = await (await req(lawyer.cookie, "/cases")).json();
  assert.ok(listed.some((c) => c.id === own));
  assert.ok(!listed.some((c) => c.id === foreign || c.id === unassigned));
  assert.ok(
    (await (await req(support.cookie, "/cases")).json()).some(
      (c) => c.id === foreign,
    ),
  );
  for (const path of [
    `/cases/${foreign}/documents`,
    `/documents/${docs[0].id}/download`,
    `/cases/${foreign}/evaluation`,
    `/cases/${foreign}/clarifications`,
    `/cases/${foreign}/notifications`,
  ])
    assert.equal((await req(lawyer.cookie, path)).status, 404, path);
  assert.equal(
    (await req(lawyer.cookie, `/documents/${docs[0].id}/analyze`, "POST"))
      .status,
    404,
  );
  assert.equal(
    (
      await req(lawyer.cookie, `/cases/${own}`, "PATCH", {
        lawyer_id: other.id,
      })
    ).status,
    403,
  );
  const draft = {
    expected_revision: 0,
    notes: "Conclusiones internas de prueba verificadas.",
    reply_type: "Respuesta",
    reply_text: "Respuesta del abogado tras revisar los antecedentes del caso.",
    amount: null,
    decision: "judicial",
  };
  assert.equal(
    (await req(support.cookie, `/cases/${own}/evaluation`, "PUT", draft))
      .status,
    403,
  );
  assert.equal(
    (await req(support.cookie, `/cases/${own}/evaluation`)).status,
    403,
  );
  assert.equal(
    (await req(lawyer.cookie, `/cases/${foreign}/evaluation`, "PUT", draft))
      .status,
    404,
  );
  assert.equal(
    (await req(lawyer.cookie, `/cases/${own}/evaluation`, "PUT", draft)).status,
    200,
  );
  const deadline = {
    case_id: own,
    title: "Audiencia prueba",
    due_at: new Date(Date.now() + 86400000).toISOString(),
  };
  assert.equal(
    (await req(support.cookie, "/deadlines", "POST", deadline)).status,
    403,
  );
  assert.equal(
    (await req(other.cookie, "/deadlines", "POST", deadline)).status,
    404,
  );
  assert.equal(
    (await req(lawyer.cookie, "/deadlines", "POST", deadline)).status,
    201,
  );
  assert.ok(
    !(await (await req(other.cookie, "/deadlines")).json()).some(
      (d) => d.case_id === own,
    ),
  );
  assert.equal(
    (
      await req(support.cookie, `/cases/${own}/clarifications`, "POST", {
        questions: "Confirma el número de contrato de trabajo suscrito.",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req(support.cookie, `/cases/${own}/notifications`, "POST", {
        kind: "response",
        token: "a".repeat(64),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(support.cookie, `/team/${support.id}`, "PUT", {
        available: true,
        specialties: ["Laboral"],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(manager.cookie, `/team/${support.id}`, "PUT", {
        available: true,
        specialties: ["Laboral"],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(manager.cookie, `/users/${manager.id}/role`, "PUT", {
        role: "soporte",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(manager.cookie, `/users/${lawyer.id}/role`, "PUT", {
        role: "soporte",
      })
    ).status,
    409,
  );
  // Reasignar retira acceso al abogado anterior, incluso con la misma cookie.
  assert.equal(
    (
      await req(support.cookie, `/cases/${own}`, "PATCH", {
        lawyer_id: other.id,
      })
    ).status,
    204,
  );
  assert.equal(
    (await req(lawyer.cookie, `/cases/${own}/evaluation`)).status,
    404,
  );
  assert.equal(
    (
      await req(manager.cookie, `/users/${lawyer.id}/role`, "PUT", {
        role: "soporte",
      })
    ).status,
    204,
  );
  assert.equal(
    (await (await req(lawyer.cookie, "/me")).json()).role,
    "soporte",
  );
  assert.equal(
    (await req(lawyer.cookie, `/cases/${foreign}/evaluation`)).status,
    403,
  );
  const newEmail = `created-${suffix}@example.com`;
  assert.equal(
    (
      await req(support.cookie, "/users", "POST", {
        name: "No autorizado",
        email: newEmail,
        password,
        role: "gerencia",
      })
    ).status,
    403,
  );
  const created = await req(manager.cookie, "/users", "POST", {
    name: "Abogado nuevo",
    email: newEmail,
    password,
    role: "abogado",
  });
  assert.equal(created.status, 201);
  users.push((await created.json()).id);
  const [stored] = await db.execute(
    "SELECT password_hash FROM users WHERE email=?",
    [newEmail],
  );
  assert.notEqual(stored[0].password_hash, password);
  assert.ok(await bcrypt.compare(password, stored[0].password_hash));
  console.log(
    "Roles smoke OK: cuentas, rol vivo por petición, Gerencia/Soporte/Abogado, casos y archivos ajenos, notas internas, plazos, reasignación, restricciones de perfil y contraseñas cifradas.",
  );
} finally {
  child?.kill();
  for (const id of ids) {
    for (const table of [
      "notifications",
      "response_links",
      "evaluations",
      "clarifications",
      "documents",
      "deadlines",
    ])
      await db.execute(`DELETE FROM ${table} WHERE case_id=?`, [id]);
    await db.execute("DELETE FROM cases WHERE id=?", [id]);
  }
  for (const id of users) {
    await db.execute("DELETE FROM lawyer_specialties WHERE user_id=?", [id]);
    await db.execute("DELETE FROM lawyer_profiles WHERE user_id=?", [id]);
    await db.execute("DELETE FROM users WHERE id=?", [id]);
  }
  await db.end();
}
