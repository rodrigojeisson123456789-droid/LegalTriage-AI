// BD de prueba sin otros plazos elegibles. SMTP siempre simulado; limpia fixtures.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "../../src/db.js";
import { runDeadlineReminders } from "../../src/deadline-reminders.js";

const suffix = randomBytes(8).toString("hex"),
  users = [],
  cases = [],
  sent = [];
const config = {
  mode: "gmail",
  configured: true,
  deadlineReminders: true,
  user: "smtp@example.com",
  origin: "http://localhost:5173",
  local: true,
};
let outcome = "accepted";
let bootProcess;
const transportFactory = () => ({
  async sendMail(message) {
    assert.ok(users.some((u) => u.email === message.to));
    assert.doesNotMatch(message.text, /RESERVADO|cliente@example.com|12345678/);
    sent.push(message);
    if (outcome !== "accepted") {
      const error = new Error("SMTP simulado");
      error.code = outcome;
      throw error;
    }
    return { accepted: [message.to] };
  },
  close() {},
});
const run = (extra) =>
  runDeadlineReminders({ config, transportFactory, ...extra });
async function user(role) {
  const email = `reminders-${suffix}-${users.length}@example.com`;
  const [r] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,'unused-test-hash',?)",
    ["Recordatorio ficticio", email, role],
  );
  const result = { id: r.insertId, email };
  users.push(result);
  return result;
}
async function record(lawyer, status = "En evaluación") {
  const [r] = await db.execute(
    "INSERT INTO cases(name,document,email,phone,description,specialty,classification_status,lawyer_id,status) VALUES ('Cliente ficticio','12345678','cliente@example.com','999999999','RESERVADO: consulta ficticia de prueba','Laboral','manual',?,?)",
    [lawyer?.id || null, status],
  );
  cases.push(r.insertId);
  return r.insertId;
}
async function deadline(id, hours) {
  const [r] = await db.execute(
    "INSERT INTO deadlines(case_id,title,due_at,created_by) VALUES (?,'Actuación ficticia',?,?)",
    [id, new Date(Date.now() + hours * 3600000), users[0].id],
  );
  return r.insertId;
}
async function move(id, hours) {
  await db.execute("UPDATE deadlines SET due_at=? WHERE id=?", [
    new Date(Date.now() + hours * 3600000),
    id,
  ]);
}
try {
  const [existing] = await db.query(
    "SELECT COUNT(*) n FROM deadlines d JOIN cases c ON c.id=d.case_id JOIN users u ON u.id=c.lawyer_id WHERE c.status<>'Atención inicial cerrada' AND u.role IN ('abogado','gerencia') AND d.due_at<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 48 HOUR)",
  );
  assert.equal(
    existing[0].n,
    0,
    "Usa una BD de prueba sin otros plazos elegibles",
  );
  const a = await user("abogado"),
    b = await user("abogado"),
    support = await user("soporte");
  const ca = await record(a),
    cb = await record(a),
    cc = await record(a);
  const first = await deadline(ca, 36);
  await deadline(cb, 12);
  await deadline(cc, -1);
  await deadline(ca, 72);
  await deadline(await record(null), -1);
  await deadline(await record(a, "Atención inicial cerrada"), -1);
  await deadline(await record(support), -1);
  const results = await Promise.all([run(), run()]);
  assert.equal(
    results.reduce((n, r) => n + r.attempted, 0),
    3,
  );
  assert.equal(sent.length, 3);
  assert.equal((await run()).attempted, 0);
  // Otro proceso con la misma BD no debe volver a enviar los avisos ya reservados.
  const code = `import 'dotenv/config';import {runDeadlineReminders} from './src/deadline-reminders.js';import {db} from './src/db.js';const result=await runDeadlineReminders({config:${JSON.stringify(config)},transportFactory:()=>{throw new Error('Duplicado tras reinicio')}});if(result.attempted!==0)process.exitCode=1;await db.end();`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(await new Promise((resolve) => child.on("exit", resolve)), 0);
  await move(first, 12);
  assert.equal((await run()).attempted, 1);
  await move(first, -1);
  assert.equal((await run()).attempted, 1);
  const [stages] = await db.execute(
    "SELECT stage FROM deadline_reminders WHERE deadline_id=? ORDER BY id",
    [first],
  );
  assert.deepEqual(
    stages.map((r) => r.stage),
    ["48h", "24h", "expired"],
  );
  await db.execute("UPDATE cases SET lawyer_id=? WHERE id=?", [b.id, cb]);
  assert.equal((await run()).attempted, 1);
  assert.equal(sent.at(-1).to, b.email);
  outcome = "EAUTH";
  await deadline(ca, 12);
  assert.deepEqual((await run()).statuses, ["failed"]);
  outcome = "accepted";
  assert.equal((await run()).attempted, 0);
  outcome = "ETIMEDOUT";
  await deadline(ca, 12);
  assert.deepEqual((await run()).statuses, ["uncertain"]);
  outcome = "accepted";
  assert.equal((await run()).attempted, 0);
  // SMTP aceptó, pero se perdió la conexión de persistencia: queda pending sin duplicar.
  const pending = await deadline(ca, 12);
  let connections = 0;
  const failingDatabase = {
    execute: db.execute.bind(db),
    getConnection: async () => {
      if (++connections === 2) throw new Error("Persistencia simulada");
      return db.getConnection();
    },
  };
  assert.deepEqual((await run({ database: failingDatabase })).statuses, [
    "pending",
  ]);
  const calls = sent.length;
  assert.equal((await run()).attempted, 0);
  assert.equal(sent.length, calls);
  const [row] = await db.execute(
    "SELECT status FROM deadline_reminders WHERE deadline_id=?",
    [pending],
  );
  assert.equal(row[0].status, "pending");
  const [events] = await db.execute(
    "SELECT details FROM case_events WHERE case_id=? AND action LIKE 'deadline.reminder_%'",
    [ca],
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /@example.com|RESERVADO|12345678/,
  );
  // Comprueba también la activación real desde index.js, sin invocar el runner.
  const startupDeadline = await deadline(ca, 12);
  const startupCode = `import nodemailer from 'nodemailer';nodemailer.createTransport=()=>({sendMail:async m=>{if(m.to!==${JSON.stringify(a.email)}||m.text.includes('RESERVADO'))throw new Error('Destino o contenido incorrecto');process.send('smtp-accepted');return {accepted:[m.to]};},close(){}});await import('./src/index.js');`;
  bootProcess = spawn(
    process.execPath,
    ["--input-type=module", "-e", startupCode],
    {
      env: {
        ...process.env,
        PORT: "3002",
        MAIL_MODE: "gmail",
        MAIL_DEADLINE_REMINDERS: "true",
        SMTP_USER: "smtp@example.com",
        SMTP_APP_PASSWORD: "test-only",
        PUBLIC_APP_URL: "http://localhost:5173",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  assert.equal(
    await Promise.race([
      new Promise((resolve) => bootProcess.once("message", resolve)),
      delay(5000, "timeout"),
    ]),
    "smtp-accepted",
  );
  let persisted = false;
  for (let n = 0; n < 40; n++) {
    const [rows] = await db.execute(
      "SELECT status FROM deadline_reminders WHERE deadline_id=?",
      [startupDeadline],
    );
    if (rows[0]?.status === "accepted") {
      persisted = true;
      break;
    }
    await delay(50);
  }
  assert.ok(persisted, "El worker al iniciar debe guardar el resultado");
  console.log(
    "Deadline reminders smoke OK: 48h/24h/vencido, responsable interno, exclusiones, concurrencia, reinicio, reasignación, EAUTH/timeout, persistencia incierta sin duplicados, metadatos privados y envío automático al arrancar la API. SMTP simulado.",
  );
} finally {
  if (bootProcess?.exitCode === null) {
    const exited = new Promise((resolve) => bootProcess.once("exit", resolve));
    bootProcess.kill();
    await exited;
  }
  for (const id of cases) {
    await db.execute("DELETE FROM deadlines WHERE case_id=?", [id]);
    await db.execute("DELETE FROM case_events WHERE case_id=?", [id]);
    await db.execute("DELETE FROM cases WHERE id=?", [id]);
  }
  for (const u of users)
    await db.execute("DELETE FROM users WHERE id=?", [u.id]);
  await db.end();
}
