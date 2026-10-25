// MySQL real, API temporal y limpieza de los datos creados por esta prueba.
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
import { withClarificationContext } from "../src/clarifications.js";
const base = "http://127.0.0.1:3002/api";
const email = `clarification-${randomBytes(8).toString("hex")}@example.com`,
  password = randomBytes(24).toString("hex");
const child = spawn(process.execPath, ["src/index.js"], {
  env: { ...process.env, PORT: "3002", GEMINI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let caseId, userId, cookie;
async function request(path, method = "GET", body, auth = true) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (child.exitCode !== null) throw new Error("API no inició");
    try {
      if ((await request("/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready);
  const [user] = await db.execute(
    "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
    ["Abogado prueba", email, await bcrypt.hash(password, 12)],
  );
  userId = user.insertId;
  await db.execute("UPDATE users SET role='gerencia' WHERE id=?", [userId]);
  const [created] = await db.execute(
    "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status) VALUES (?,?,?,?,?,'Indeterminado','unavailable')",
    [
      "Cliente prueba",
      "12345678",
      email,
      "999999999",
      "Consulta de prueba sobre despido y beneficios laborales.",
    ],
  );
  caseId = created.insertId;
  assert.equal((await request(`/cases/${caseId}/clarifications`)).status, 401);
  assert.equal(
    (
      await request(`/cases/${caseId}/clarifications`, "POST", {
        questions: "¿Cuándo ocurrió el despido?",
      })
    ).status,
    401,
  );
  const login = await request("/login", "POST", { email, password }, false);
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await request(`/cases/${caseId}`, "PATCH", { specialty: "Laboral" }))
      .status,
    204,
  );
  let [cases] = await db.execute(
    "SELECT specialty,classification_status,status FROM cases WHERE id=?",
    [caseId],
  );
  assert.equal(cases[0].specialty, "Laboral");
  assert.equal(cases[0].classification_status, "manual");
  assert.equal(
    (
      await request(`/cases/${caseId}/clarifications`, "POST", {
        questions: "corto",
      })
    ).status,
    400,
  );
  const first = await request(`/cases/${caseId}/clarifications`, "POST", {
    questions: "¿En qué fecha ocurrió el despido y hubo una carta?",
  });
  assert.equal(first.status, 201);
  const a = await first.json();
  const second = await request(`/cases/${caseId}/clarifications`, "POST", {
    questions: "Indica la fecha exacta del despido y si recibiste una carta.",
  });
  assert.equal(second.status, 201);
  const b = await second.json();
  assert.equal(
    (await request("/clarifications/access", "POST", { token: a.token }, false))
      .status,
    404,
  );
  const access = await request(
    "/clarifications/access",
    "POST",
    { token: b.token },
    false,
  );
  assert.equal(access.status, 200);
  assert.deepEqual(Object.keys(await access.json()).sort(), [
    "expires_at",
    "questions",
  ]);
  const history = await (
    await request(`/cases/${caseId}/clarifications`)
  ).json();
  assert.equal(history.length, 2);
  assert.equal(history[0].token_hash, undefined);
  assert.equal(history[0].token, undefined);
  const [stored] = await db.execute(
    "SELECT token_hash FROM clarifications WHERE id=?",
    [b.id],
  );
  assert.notEqual(stored[0].token_hash, b.token);
  [cases] = await db.execute("SELECT status FROM cases WHERE id=?", [caseId]);
  assert.equal(cases[0].status, "Pendiente de aclaración");
  const answer = {
    token: b.token,
    answer: "El despido ocurrió el 15 de octubre y no recibí carta.",
    consent: true,
  };
  assert.equal(
    (
      await request(
        "/clarifications/answer",
        "POST",
        { ...answer, consent: false },
        false,
      )
    ).status,
    400,
  );
  const results = await Promise.all([
    request("/clarifications/answer", "POST", answer, false),
    request("/clarifications/answer", "POST", answer, false),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await request("/clarifications/access", "POST", { token: b.token }, false))
      .status,
    404,
  );
  [cases] = await db.execute("SELECT status FROM cases WHERE id=?", [caseId]);
  assert.equal(cases[0].status, "En evaluación");
  assert.match(
    await withClarificationContext(caseId, "Consulta original"),
    /El despido ocurrió/,
  );
  const exp = await (
    await request(`/cases/${caseId}/clarifications`, "POST", {
      questions: "Indica si conservas contrato y boletas de pago.",
    })
  ).json();
  await db.execute(
    "UPDATE clarifications SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE id=?",
    [exp.id],
  );
  assert.equal(
    (
      await request(
        "/clarifications/access",
        "POST",
        { token: exp.token },
        false,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/clarifications/answer",
        "POST",
        { ...answer, token: exp.token },
        false,
      )
    ).status,
    409,
  );
  const cancel = await (
    await request(`/cases/${caseId}/clarifications`, "POST", {
      questions: "Confirma si deseas continuar la evaluación del caso.",
    })
  ).json();
  assert.equal(
    (await request(`/cases/${caseId}/clarifications/${cancel.id}`, "DELETE"))
      .status,
    204,
  );
  assert.equal(
    (
      await request(
        "/clarifications/access",
        "POST",
        { token: cancel.token },
        false,
      )
    ).status,
    404,
  );
  const [count] = await db.execute(
    "SELECT COUNT(*) AS n FROM cases WHERE email=?",
    [email],
  );
  assert.equal(count[0].n, 1);
  console.log(
    "Clarifications smoke OK: Laboral/manual, permisos, historial, enlace hash, reemplazo, vencimiento, consentimiento, respuesta única concurrente, contexto y mismo caso.",
  );
} finally {
  child.kill();
  if (caseId) {
    await db.execute("DELETE FROM clarifications WHERE case_id=?", [caseId]);
    await db.execute("DELETE FROM cases WHERE id=?", [caseId]);
  }
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  await db.end();
}
