// MySQL real, API temporal y limpieza exclusiva de los datos de prueba.
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
const base = "http://127.0.0.1:3002/api",
  email = `evaluation-${randomBytes(8).toString("hex")}@example.com`,
  password = randomBytes(24).toString("hex");
let userId, cookie;
const ids = [];
const child = spawn(process.execPath, ["src/index.js"], {
  env: { ...process.env, PORT: "3002", GEMINI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
const draft = {
  expected_revision: 0,
  notes: "NOTA INTERNA RESERVADA: documentos revisados y hechos confirmados.",
  reply_type: "Cotización",
  reply_text:
    "Proponemos revisar los contratos y coordinar una reunión con el cliente.",
  amount: 250.5,
  decision: "close",
};
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
async function makeCase() {
  const [r] = await db.execute(
    "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status) VALUES (?,?,?,?,?,'Laboral','classified')",
    [
      "Cliente evaluación",
      "12345678",
      email,
      "999999999",
      "Consulta laboral ficticia para prueba.",
    ],
  );
  ids.push(r.insertId);
  return r.insertId;
}
try {
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
  const [u] = await db.execute(
    "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
    ["Abogado prueba", email, await bcrypt.hash(password, 12)],
  );
  userId = u.insertId;
  const id = await makeCase(),
    path = `/cases/${id}/evaluation`;
  assert.equal((await req(path)).status, 401);
  assert.equal((await req(path, "PUT", draft)).status, 401);
  const login = await req("/login", "POST", { email, password }, false);
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await req(path + "/share", "POST")).status, 409);
  assert.equal(
    (await req(path, "PUT", { ...draft, amount: null })).status,
    400,
  );
  assert.equal((await req(path, "PUT", draft)).status, 200);
  assert.equal((await req(path, "PUT", draft)).status, 409);
  assert.equal(
    (
      await req(path + "/approve", "POST", {
        expected_revision: 1,
        confirmed: false,
      })
    ).status,
    400,
  );
  const clar = await (
    await req(`/cases/${id}/clarifications`, "POST", {
      questions: "Confirma la fecha de inicio del contrato laboral.",
    })
  ).json();
  assert.equal(
    (
      await req(path + "/approve", "POST", {
        expected_revision: 1,
        confirmed: true,
      })
    ).status,
    409,
  );
  await req(`/cases/${id}/clarifications/${clar.id}`, "DELETE");
  const approvals = await Promise.all([
    req(path + "/approve", "POST", { expected_revision: 1, confirmed: true }),
    req(path + "/approve", "POST", { expected_revision: 1, confirmed: true }),
  ]);
  assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 409]);
  const record = await (await req(path)).json();
  assert.equal(record.case_status, "Atención inicial cerrada");
  assert.equal(record.evaluation.approved_by, userId);
  assert.equal(
    (await req(path, "PUT", { ...draft, expected_revision: 2 })).status,
    409,
  );
  assert.equal(
    (await req(`/cases/${id}`, "PATCH", { status: "En evaluación" })).status,
    409,
  );
  assert.equal(
    (
      await req(`/cases/${id}/clarifications`, "POST", {
        questions: "No debe reabrir una atención que está cerrada.",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/deadlines", "POST", {
        case_id: id,
        title: "Audiencia",
        due_at: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
    409,
  );
  const first = await (await req(path + "/share", "POST")).json();
  const visible = await req(
    "/responses/access",
    "POST",
    { token: first.token },
    false,
  );
  assert.equal(visible.status, 200);
  const publicData = await visible.json();
  assert.equal(publicData.reply_text, draft.reply_text);
  assert.equal(Number(publicData.amount), 250.5);
  assert.equal(publicData.notes, undefined);
  assert.equal(JSON.stringify(publicData).includes("NOTA INTERNA"), false);
  const next = await (await req(path + "/share", "POST")).json();
  assert.equal(
    (await req("/responses/access", "POST", { token: first.token }, false))
      .status,
    404,
  );
  await db.execute(
    "UPDATE response_links SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE case_id=?",
    [id],
  );
  assert.equal(
    (await req("/responses/access", "POST", { token: next.token }, false))
      .status,
    404,
  );
  const rev = await (await req(path + "/share", "POST")).json();
  await req(path + "/share", "DELETE");
  assert.equal(
    (await req("/responses/access", "POST", { token: rev.token }, false))
      .status,
    404,
  );
  const judicial = await makeCase(),
    jp = `/cases/${judicial}/evaluation`;
  assert.equal(
    (
      await req("/deadlines", "POST", {
        case_id: judicial,
        title: "Audiencia futura",
        due_at: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
    201,
  );
  await req(jp, "PUT", draft);
  assert.equal(
    (
      await req(jp + "/approve", "POST", {
        expected_revision: 1,
        confirmed: true,
      })
    ).status,
    409,
  );
  await req(jp, "PUT", {
    ...draft,
    expected_revision: 1,
    decision: "judicial",
  });
  assert.equal(
    (
      await req(jp + "/approve", "POST", {
        expected_revision: 2,
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await req(jp)).json()).case_status,
    "En seguimiento judicial",
  );
  assert.equal(
    (
      await req("/deadlines", "POST", {
        case_id: judicial,
        title: "Escrito futuro",
        due_at: new Date(Date.now() + 172800000).toISOString(),
      })
    ).status,
    201,
  );
  console.log(
    "Evaluations smoke OK: permisos, borradores, conflictos, aprobación única, aclaraciones/plazos, estados, bloqueo, privacidad de notas y enlaces reemplazados/vencidos/revocados.",
  );
} finally {
  child.kill();
  for (const id of ids) {
    for (const table of [
      "response_links",
      "evaluations",
      "clarifications",
      "deadlines",
    ])
      await db.execute(`DELETE FROM ${table} WHERE case_id=?`, [id]);
    await db.execute("DELETE FROM cases WHERE id=?", [id]);
  }
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  await db.end();
}
