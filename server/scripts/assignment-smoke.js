// Requiere una BD de prueba sin otros perfiles Laboral disponibles. MySQL real,
// Gemini simulado en el proceso temporal; elimina exclusivamente sus fixtures.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
const email = `assignment-${randomBytes(8).toString("hex")}@example.com`,
  password = randomBytes(24).toString("hex"),
  base = "http://127.0.0.1:3002/api",
  users = [],
  ids = [];
let child, cookie;
const mock = `globalThis.fetch=async(url,options)=>{if(!String(url).startsWith('https://generativelanguage.googleapis.com/'))throw new Error('Unexpected destination');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(options.body.includes('indeterminada')?'Indeterminado':'Laboral')}]}}]})}};`;
async function req(path, method = "GET", body, auth = true) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie && auth ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function make(
  lawyer = null,
  status = "Nuevo",
  classification = "classified",
) {
  const [r] = await db.execute(
    "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status,lawyer_id,status) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      "Cliente asignación",
      "12345678",
      email,
      "999999999",
      "Consulta laboral ficticia.",
      "Laboral",
      classification,
      lawyer,
      status,
    ],
  );
  ids.push(r.insertId);
  return r.insertId;
}
async function publicCase(
  description = "Consulta laboral ficticia por despido sin justificación.",
) {
  const r = await req(
    "/cases",
    "POST",
    {
      name: "Cliente público",
      document: "12345678",
      email,
      phone: "999999999",
      description,
      consent: true,
    },
    false,
  );
  assert.equal(r.status, 201);
  const id = (await r.json()).id;
  ids.push(id);
  const [rows] = await db.execute("SELECT lawyer_id FROM cases WHERE id=?", [
    id,
  ]);
  return { id, lawyer: rows[0].lawyer_id };
}
try {
  const [existing] = await db.query(
    "SELECT COUNT(*) AS n FROM lawyer_profiles p JOIN lawyer_specialties s ON s.user_id=p.user_id WHERE p.available=1 AND s.specialty='Laboral'",
  );
  assert.equal(
    existing[0].n,
    0,
    "Usa una base de prueba sin otros abogados Laboral disponibles",
  );
  for (const name of ["Abogado A", "Abogado B", "Soporte"]) {
    const [u] = await db.execute(
      "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
      [name, `${users.length}-${email}`, await bcrypt.hash(password, 12)],
    );
    users.push(u.insertId);
    await db.execute("UPDATE users SET role=? WHERE id=?", [
      users.length === 3 ? "gerencia" : "abogado",
      u.insertId,
    ]);
  }
  child = spawn(
    process.execPath,
    [
      "--import",
      "data:text/javascript," + encodeURIComponent(mock),
      "src/index.js",
    ],
    {
      env: { ...process.env, PORT: "3002", GEMINI_API_KEY: "test-only" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (child.exitCode !== null) throw new Error("API no inició");
    try {
      if ((await req("/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready);
  assert.equal((await req("/team")).status, 401);
  assert.equal(
    (
      await req(`/team/${users[0]}`, "PUT", {
        available: true,
        specialties: ["Laboral"],
      })
    ).status,
    401,
  );
  const login = await req(
    "/login",
    "POST",
    { email: "2-" + email, password },
    false,
  );
  cookie = login.headers.get("set-cookie").split(";")[0];
  const initial = await (await req("/team")).json();
  assert.equal(initial.find((u) => u.id === users[2]).available, false);
  assert.equal(
    (
      await req(`/team/${users[0]}`, "PUT", {
        available: true,
        specialties: [],
      })
    ).status,
    400,
  );
  for (const id of users.slice(0, 2))
    assert.equal(
      (
        await req(`/team/${id}`, "PUT", {
          available: true,
          specialties: ["Laboral"],
        })
      ).status,
      204,
    );
  await make(users[0]);
  await make(users[0]);
  await make(users[1], "Atención inicial cerrada");
  assert.equal((await publicCase()).lawyer, users[1]);
  assert.equal((await publicCase()).lawyer, users[1]);
  const tied = await publicCase();
  assert.equal(tied.lawyer, users[0]);
  assert.equal(
    (await req(`/cases/${tied.id}/auto-assign`, "POST")).status,
    409,
  );
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => make()));
  const assigned = await Promise.all(
    concurrent.map((id) => req(`/cases/${id}/auto-assign`, "POST")),
  );
  assert.ok(assigned.every((r) => r.status === 200));
  const [counts] = await db.execute(
    "SELECT lawyer_id,COUNT(*) AS n FROM cases WHERE email=? AND status<>'Atención inicial cerrada' AND lawyer_id IS NOT NULL GROUP BY lawyer_id",
    [email],
  );
  assert.ok(Math.abs(counts[0].n - counts[1].n) <= 1);
  await req(`/team/${users[1]}`, "PUT", {
    available: false,
    specialties: ["Laboral"],
  });
  assert.equal((await publicCase()).lawyer, users[0]);
  await req(`/team/${users[0]}`, "PUT", {
    available: false,
    specialties: ["Laboral"],
  });
  const pending = await publicCase();
  assert.equal(pending.lawyer, null);
  assert.equal(
    (await req(`/cases/${pending.id}/auto-assign`, "POST")).status,
    409,
  );
  assert.equal(
    (await publicCase("Consulta indeterminada sin especialidad reconocible."))
      .lawyer,
    null,
  );
  await req(`/team/${users[0]}`, "PUT", {
    available: true,
    specialties: ["Civil"],
  });
  assert.equal((await publicCase()).lawyer, null);
  const closed = await make(null, "Atención inicial cerrada");
  assert.equal((await req(`/cases/${closed}/auto-assign`, "POST")).status, 409);
  const failed = await make(null, "Nuevo", "unavailable");
  assert.equal((await req(`/cases/${failed}/auto-assign`, "POST")).status, 409);
  assert.equal(
    (await req(`/cases/${tied.id}`, "PATCH", { lawyer_id: users[1] })).status,
    204,
  );
  const [manual] = await db.execute("SELECT lawyer_id FROM cases WHERE id=?", [
    tied.id,
  ]);
  assert.equal(manual[0].lawyer_id, users[1]);
  console.log(
    "Assignment smoke OK: configuración y permisos, asignación pública con Gemini simulado, menor carga, empate, concurrencia, cierre excluido, disponibilidad, Indeterminado/fallo y cambio manual.",
  );
} finally {
  child?.kill();
  for (const id of ids) await db.execute("DELETE FROM cases WHERE id=?", [id]);
  for (const id of users) {
    await db.execute("DELETE FROM lawyer_specialties WHERE user_id=?", [id]);
    await db.execute("DELETE FROM lawyer_profiles WHERE user_id=?", [id]);
    await db.execute("DELETE FROM users WHERE id=?", [id]);
  }
  await db.end();
}
