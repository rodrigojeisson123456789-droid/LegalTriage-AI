// MySQL real, Gmail simulado. No envía correo a destinatarios reales.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
const base = "http://127.0.0.1:3002/api",
  email = `mail-${randomBytes(8).toString("hex")}@example.com`,
  password = randomBytes(24).toString("hex");
let child, userId, caseId, cookie;
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
async function start(mode, outcome = "ok") {
  const mock = `import nodemailer from '${import.meta.resolve("nodemailer")}';nodemailer.createTransport=()=>({sendMail:async message=>{if(${JSON.stringify(outcome)}!=='ok'){const error=new Error('SMTP mock');error.code=${JSON.stringify(outcome)};throw error;}if(!message.to.endsWith('@example.com')||message.text.includes('INTERNAL SECRET'))throw new Error('Invalid message');return {accepted:[message.to]};},close(){}});`;
  child = spawn(
    process.execPath,
    [
      "--import",
      "data:text/javascript," + encodeURIComponent(mock),
      "src/index.js",
    ],
    {
      env: {
        ...process.env,
        PORT: "3002",
        GEMINI_API_KEY: "",
        MAIL_MODE: mode,
        SMTP_USER: "test@example.com",
        SMTP_APP_PASSWORD: "test-only",
        PUBLIC_APP_URL: "https://legal.example.com",
      },
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
}
async function stop() {
  if (child?.exitCode === null) {
    const ended = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await ended;
  }
  child = null;
}
try {
  const [u] = await db.execute(
    "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
    ["Abogado correo", email, await bcrypt.hash(password, 12)],
  );
  userId = u.insertId;
  await db.execute("UPDATE users SET role='gerencia' WHERE id=?", [userId]);
  const [c] = await db.execute(
    "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status) VALUES (?,?,?,?,?,'Laboral','manual')",
    [
      "Cliente correo",
      "12345678",
      email,
      "999999999",
      "Consulta ficticia para probar correo.",
    ],
  );
  caseId = c.insertId;
  await start("preview");
  assert.equal((await req("/mail/config")).status, 401);
  const login = await req("/login", "POST", { email, password }, false);
  cookie = login.headers.get("set-cookie").split(";")[0];
  const link = await (
    await req(`/cases/${caseId}/clarifications`, "POST", {
      questions: "Confirma la fecha de ingreso del contrato laboral.",
    })
  ).json();
  const payload = { kind: "clarification", token: link.token };
  const preview = await (
    await req(`/cases/${caseId}/notifications`, "POST", payload)
  ).json();
  assert.equal(preview.status, "preview");
  assert.equal(preview.recipient, email);
  assert.match(preview.text, /https:\/\/legal.example.com/);
  let [rows] = await db.execute(
    "SELECT id FROM notifications WHERE case_id=?",
    [caseId],
  );
  assert.equal(rows.length, 0);
  assert.equal(
    (
      await req(`/cases/${caseId}/notifications`, "POST", {
        kind: "response",
        token: link.token,
      })
    ).status,
    409,
  );
  await stop();
  await start("gmail");
  const sent = await req(`/cases/${caseId}/notifications`, "POST", payload);
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).status, "accepted");
  assert.equal(
    (await req(`/cases/${caseId}/notifications`, "POST", payload)).status,
    409,
  );
  const logs = await (await req(`/cases/${caseId}/notifications`)).json();
  assert.equal(logs.events[0].status, "accepted");
  assert.equal(logs.events[0].token_hash, undefined);
  for (const outcome of ["EAUTH", "ETIMEDOUT"]) {
    const current = await (
      await req(`/cases/${caseId}/clarifications`, "POST", {
        questions: "Confirma los datos adicionales para la prueba de fallo.",
      })
    ).json();
    const data = { kind: "clarification", token: current.token };
    await stop();
    await start("gmail", outcome);
    assert.equal(
      (await req(`/cases/${caseId}/notifications`, "POST", data)).status,
      502,
    );
    const history = await (await req(`/cases/${caseId}/notifications`)).json();
    assert.equal(
      history.events[0].status,
      outcome === "EAUTH" ? "failed" : "uncertain",
    );
    if (outcome === "EAUTH") {
      await stop();
      await start("gmail");
      assert.equal(
        (await req(`/cases/${caseId}/notifications`, "POST", data)).status,
        200,
      );
    } else
      assert.equal(
        (await req(`/cases/${caseId}/notifications`, "POST", data)).status,
        409,
      );
    await req(`/cases/${caseId}/clarifications/${current.id}`, "DELETE");
  }
  await stop();
  await start("gmail");
  await req(`/cases/${caseId}/clarifications/${link.id}`, "DELETE");
  await req(`/cases/${caseId}/evaluation`, "PUT", {
    expected_revision: 0,
    notes: "INTERNAL SECRET: conclusiones privadas del abogado.",
    reply_type: "Respuesta",
    reply_text: "Respuesta aprobada ficticia para el cliente del estudio.",
    amount: null,
    decision: "close",
  });
  await req(`/cases/${caseId}/evaluation/approve`, "POST", {
    expected_revision: 1,
    confirmed: true,
  });
  const approved = await (
    await req(`/cases/${caseId}/evaluation/share`, "POST")
  ).json();
  assert.equal(
    (
      await req(`/cases/${caseId}/notifications`, "POST", {
        kind: "response",
        token: approved.token,
      })
    ).status,
    200,
  );
  await req(`/cases/${caseId}/evaluation/share`, "DELETE");
  assert.equal(
    (
      await req(`/cases/${caseId}/notifications`, "POST", {
        kind: "response",
        token: approved.token,
      })
    ).status,
    409,
  );
  console.log(
    "Mail smoke OK: preview sin SMTP ni registro, permisos, destinatario del caso, enlace vigente, Gmail simulado, duplicado bloqueado, respuesta aprobada y notas privadas excluidas.",
  );
} finally {
  await stop();
  if (caseId) {
    for (const table of [
      "notifications",
      "response_links",
      "evaluations",
      "clarifications",
    ])
      await db.execute(`DELETE FROM ${table} WHERE case_id=?`, [caseId]);
    await db.execute("DELETE FROM case_events WHERE case_id=?", [caseId]);
    await db.execute("DELETE FROM cases WHERE id=?", [caseId]);
  }
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  await db.end();
}
