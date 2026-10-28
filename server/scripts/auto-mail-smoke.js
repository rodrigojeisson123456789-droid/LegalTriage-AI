// MySQL real, SMTP simulado; nunca envía correos reales.
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
const suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex"),
  email = `auto-${suffix}@example.com`,
  ids = [],
  dir = mkdtempSync(path.join(tmpdir(), "legaltriage-auto-")),
  journal = path.join(dir, "calls");
let child, userId, cookie;
const base = "http://127.0.0.1:3002/api";
async function req(p, method = "GET", body) {
  return fetch(base + p, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function stop() {
  if (child?.exitCode === null) {
    const exited = new Promise((r) => child.once("exit", r));
    child.kill();
    await exited;
  }
}
function calls() {
  try {
    return readFileSync(journal, "utf8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
async function start(
  mode,
  outcome = "ok",
  enabled = "true",
  configured = true,
) {
  await stop();
  const mock = `import nodemailer from ${JSON.stringify(import.meta.resolve("nodemailer"))};import {appendFileSync} from 'node:fs';nodemailer.createTransport=()=>({sendMail:async m=>{if(m.to!==${JSON.stringify(email)}||m.text.includes('NOTAS INTERNAS')||!m.text.includes('RESPUESTA APROBADA'))throw new Error('Mensaje incorrecto');appendFileSync(${JSON.stringify(journal)},'attempt\\n');if(${JSON.stringify(outcome)}!=='ok'){const e=new Error('SMTP simulado');e.code=${JSON.stringify(outcome)};throw e}return {accepted:[m.to]}},close(){}});`;
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
        MAIL_AUTO_RESPONSE: enabled,
        SMTP_USER: configured ? "test@example.com" : "",
        SMTP_APP_PASSWORD: configured ? "test-only" : "",
        PUBLIC_APP_URL: "http://localhost:5173",
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
  const r = await req("/login", "POST", { email, password });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
}
try {
  const [u] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
    ["Gerencia prueba", email, await bcrypt.hash(password, 12), "gerencia"],
  );
  userId = u.insertId;
  for (const [mode, outcome, enabled, configured, expected] of [
    ["preview", "ok", "true", true, "preview"],
    ["gmail", "ok", "false", true, "disabled"],
    ["gmail", "ok", "true", false, "not_configured"],
    ["gmail", "ok", "true", true, "accepted"],
    ["gmail", "EAUTH", "true", true, "failed"],
    ["gmail", "ETIMEDOUT", "true", true, "uncertain"],
  ]) {
    await start(mode, outcome, enabled, configured);
    const before = calls();
    const [c] = await db.execute(
      "INSERT INTO cases(name,document,email,phone,description,specialty,classification_status) VALUES ('Cliente prueba','12345678',?,'999999999','Consulta ficticia para aprobar y notificar.','Penal','manual')",
      [email],
    );
    const id = c.insertId;
    ids.push(id);
    const ep = `/cases/${id}/evaluation`;
    const draft = {
      expected_revision: 0,
      notes: "NOTAS INTERNAS reservadas del abogado que nunca se envían.",
      reply_type: "Respuesta",
      reply_text: "RESPUESTA APROBADA ficticia para el cliente del estudio.",
      amount: null,
      decision: "close",
    };
    assert.equal((await req(ep, "PUT", draft)).status, 200);
    assert.equal(calls(), before);
    const results = await Promise.all([
      req(ep + "/approve", "POST", { expected_revision: 1, confirmed: true }),
      req(ep + "/approve", "POST", { expected_revision: 1, confirmed: true }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const body = await results.find((r) => r.status === 200).json();
    assert.equal(body.notification.status, expected);
    assert.equal(
      calls() - before,
      ["accepted", "failed", "uncertain"].includes(expected) ? 1 : 0,
    );
    const current = await (await req(ep)).json();
    assert.ok(current.evaluation.approved_at);
    assert.equal(current.case_status, "Atención inicial cerrada");
    const [logs] = await db.execute(
      "SELECT status FROM notifications WHERE case_id=?",
      [id],
    );
    assert.equal(
      logs.length,
      ["accepted", "failed", "uncertain"].includes(expected) ? 1 : 0,
    );
    if (logs.length) assert.equal(logs[0].status, expected);
    assert.equal(
      (
        await req(ep + "/approve", "POST", {
          expected_revision: 2,
          confirmed: true,
        })
      ).status,
      409,
    );
    assert.equal(calls() - before, logs.length);
    const history = await (await req(`/cases/${id}/history`)).json();
    assert.equal(JSON.stringify(history).includes(draft.notes), false);
    console.log(
      `Auto mail ${expected}: OK, aprobación única y ${logs.length} intento(s) registrados.`,
    );
  }
} finally {
  await stop();
  for (const id of ids) {
    for (const table of [
      "case_events",
      "notifications",
      "response_links",
      "evaluations",
    ])
      await db.execute(`DELETE FROM ${table} WHERE case_id=?`, [id]);
    await db.execute("DELETE FROM cases WHERE id=?", [id]);
  }
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  rmSync(dir, { recursive: true, force: true });
  await db.end();
}
