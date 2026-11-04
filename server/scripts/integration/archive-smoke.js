// MySQL real, sin Gemini/Gmail externos. Crea y elimina solo sus fixtures.
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../../src/db.js";

const base = "http://127.0.0.1:3002/api";
const suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex");
const users = [],
  ids = [];
let child;
async function req(cookie, path, method = "GET", body) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
}
async function json(cookie, path) {
  const response = await req(cookie, path);
  assert.equal(response.status, 200);
  return response.json();
}
async function account(role) {
  const email = `${role}-${users.length}-${suffix}@example.com`;
  const [result] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
    [role + " prueba archivo", email, await bcrypt.hash(password, 12), role],
  );
  users.push(result.insertId);
  const login = await req(null, "/login", "POST", { email, password });
  assert.equal(login.status, 200);
  return {
    id: result.insertId,
    cookie: login.headers.get("set-cookie").split(";")[0],
  };
}
try {
  child = spawn(process.execPath, ["src/index.js"], {
    env: {
      ...process.env,
      PORT: "3002",
      GEMINI_API_KEY: "",
      MAIL_MODE: "preview",
      MAIL_DEADLINE_REMINDERS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
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
    outsider = await account("abogado");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Cliente ficticio archivo",
    document: "12345678",
    email: suffix + "@example.com",
    phone: "999999999",
    description:
      "Consulta laboral ficticia para probar el archivo manual en cualquier estado.",
    consent: "true",
  }))
    form.set(key, value);
  form.set("attachment", new Blob([bytes]), "consulta-ficticia.pdf");
  const created = await req(null, "/cases", "POST", form);
  assert.equal(created.status, 201);
  const id = (await created.json()).id;
  ids.push(id);
  const path = `/cases/${id}`,
    archive = path + "/archive";
  assert.equal(
    (await req(manager.cookie, path, "PATCH", { lawyer_id: lawyer.id })).status,
    204,
  );
  const deadlineResponse = await req(lawyer.cookie, "/deadlines", "POST", {
    case_id: id,
    title: "Plazo ficticio que sigue activo al archivar",
    due_at: new Date(Date.now() + 6 * 3600000).toISOString(),
  });
  assert.equal(deadlineResponse.status, 201);
  const deadlineId = (await deadlineResponse.json()).id;
  for (const status of [
    "Nuevo",
    "En evaluación",
    "Pendiente de aclaración",
    "En seguimiento judicial",
  ]) {
    await db.execute("UPDATE cases SET status=? WHERE id=?", [status, id]);
    assert.equal(
      (await req(lawyer.cookie, archive, "PATCH", { archived: true })).status,
      204,
    );
    assert.equal((await json(lawyer.cookie, path)).status, status);
    assert.ok((await json(lawyer.cookie, path)).archived_at);
    assert.equal(
      (await json(lawyer.cookie, "/cases")).some((c) => c.id === id),
      false,
    );
    assert.ok(
      (await json(lawyer.cookie, "/cases?archive=archived")).some(
        (c) => c.id === id && c.status === status,
      ),
    );
    const reminder = (await json(lawyer.cookie, "/deadlines")).find(
      (d) => d.id === deadlineId,
    );
    assert.ok(reminder);
    assert.equal(reminder.case_status, status);
    assert.equal(reminder.urgency, "Crítico");
    const teamMember = (await json(manager.cookie, "/team")).find(
      (u) => u.id === lawyer.id,
    );
    assert.equal(Number(teamMember.active_cases), 1);
    assert.equal(
      (await req(lawyer.cookie, archive, "PATCH", { archived: false })).status,
      204,
    );
    assert.equal((await json(lawyer.cookie, path)).status, status);
  }
  await db.execute("DELETE FROM deadlines WHERE id=?", [deadlineId]);
  await db.execute("UPDATE cases SET status='En evaluación' WHERE id=?", [id]);
  const evaluation = {
    expected_revision: 0,
    notes: "Fundamento ficticio reservado para comprobar conservación.",
    reply_type: "Respuesta",
    reply_text:
      "Respuesta ficticia revisada por el profesional para la prueba de archivo.",
    amount: null,
    decision: "close",
  };
  assert.equal(
    (await req(lawyer.cookie, path + "/evaluation", "PUT", evaluation)).status,
    200,
  );
  assert.equal(
    (
      await req(lawyer.cookie, path + "/evaluation/approve", "POST", {
        expected_revision: 1,
        confirmed: true,
      })
    ).status,
    200,
  );
  const beforeEvaluation = await json(lawyer.cookie, path + "/evaluation");
  const beforeDocuments = await json(lawyer.cookie, path + "/documents");
  const share = await (
    await req(lawyer.cookie, path + "/evaluation/share", "POST")
  ).json();
  for (const archived of [true, false]) {
    assert.equal((await req(null, archive, "PATCH", { archived })).status, 401);
    assert.equal(
      (await req(support.cookie, archive, "PATCH", { archived })).status,
      403,
    );
    assert.equal(
      (await req(outsider.cookie, archive, "PATCH", { archived })).status,
      404,
    );
  }
  for (const body of [
    {},
    { archived: "true" },
    { archived: true, status: "Nuevo" },
  ])
    assert.equal(
      (await req(lawyer.cookie, archive, "PATCH", body)).status,
      400,
    );
  const responses = await Promise.all([
    req(lawyer.cookie, archive, "PATCH", { archived: true }),
    req(lawyer.cookie, archive, "PATCH", { archived: true }),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [204, 204],
  );
  const archivedCase = await json(lawyer.cookie, path);
  assert.ok(archivedCase.archived_at);
  assert.equal(archivedCase.status, "Atención inicial cerrada");
  for (const user of [manager, lawyer, support]) {
    assert.equal(
      (await json(user.cookie, "/cases")).some((c) => c.id === id),
      false,
    );
    assert.equal(
      (await json(user.cookie, "/cases?archive=archived")).some(
        (c) => c.id === id,
      ),
      true,
    );
  }
  assert.equal(
    (await json(outsider.cookie, "/cases?archive=archived")).some(
      (c) => c.id === id,
    ),
    false,
  );
  assert.equal((await req(outsider.cookie, path)).status, 404);
  assert.equal((await req(manager.cookie, "/cases?archive=all")).status, 400);
  assert.deepEqual(
    await json(lawyer.cookie, path + "/documents"),
    beforeDocuments,
  );
  assert.deepEqual(
    await json(lawyer.cookie, path + "/evaluation"),
    beforeEvaluation,
  );
  const download = await req(
    lawyer.cookie,
    `/documents/${beforeDocuments[0].id}/download`,
  );
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  const publicResponse = await req(null, "/responses/access", "POST", {
    token: share.token,
  });
  assert.equal(publicResponse.status, 200);
  const visible = await publicResponse.json();
  assert.equal(visible.reply_text, evaluation.reply_text);
  assert.equal(visible.notes, undefined);
  let history = await json(lawyer.cookie, path + "/history");
  assert.equal(
    history.events.filter((e) => e.action === "case.archived").length,
    5,
  );
  assert.equal(
    history.events.find((e) => e.action === "case.archived").actor_role,
    "abogado",
  );
  assert.ok(
    history.events.some(
      (e) => e.action === "evaluation.approved" && e.has_version,
    ),
  );
  // La migración repetida conserva el archivo y las versiones aprobadas.
  for (let i = 0; i < 2; i++) {
    const migration = spawn(process.execPath, ["src/setup.js"], {
      env: process.env,
      stdio: "ignore",
    });
    assert.equal(
      await new Promise((resolve) => migration.once("exit", resolve)),
      0,
    );
  }
  assert.equal(
    (await json(lawyer.cookie, path)).archived_at,
    archivedCase.archived_at,
  );
  assert.deepEqual(
    await json(lawyer.cookie, path + "/evaluation"),
    beforeEvaluation,
  );
  assert.deepEqual(await json(lawyer.cookie, path + "/history"), history);
  assert.equal(
    (await req(manager.cookie, archive, "PATCH", { archived: false })).status,
    204,
  );
  assert.equal(
    (await req(manager.cookie, archive, "PATCH", { archived: false })).status,
    204,
  );
  const restored = await json(lawyer.cookie, path);
  assert.equal(restored.archived_at, null);
  assert.equal(restored.status, "Atención inicial cerrada");
  assert.equal(
    (await json(lawyer.cookie, "/cases")).some((c) => c.id === id),
    true,
  );
  assert.equal(
    (await json(lawyer.cookie, "/cases?archive=archived")).some(
      (c) => c.id === id,
    ),
    false,
  );
  assert.equal(
    (await req(lawyer.cookie, path, "PATCH", { status: "En evaluación" }))
      .status,
    409,
  );
  history = await json(lawyer.cookie, path + "/history");
  assert.equal(
    history.events.filter((e) => e.action === "case.unarchived").length,
    5,
  );
  assert.equal(
    history.events.find((e) => e.action === "case.unarchived").actor_role,
    "gerencia",
  );
  assert.deepEqual(
    await json(lawyer.cookie, path + "/documents"),
    beforeDocuments,
  );
  console.log(
    "Archive smoke OK: archivo manual en todos los estados, plazos y carga de trabajo activos, permisos, listas separadas, acceso directo, documento y respuesta conservados, historial sin duplicados, migración repetible y devolución con el mismo estado.",
  );
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
  }
  for (const id of ids) {
    for (const table of [
      "case_events",
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
  for (const id of users)
    await db.execute("DELETE FROM users WHERE id=?", [id]);
  await db.end();
}
