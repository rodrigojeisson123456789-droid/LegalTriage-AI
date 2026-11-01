// MySQL real, respuestas de Gemini simuladas y aclaraciones por sus rutas reales.
// Sin claves reales, correo externo ni datos de clientes; limpia sus fixtures.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db.js";

const base = "http://127.0.0.1:3002/api";
const email = `analysis-context-${randomBytes(8).toString("hex")}@example.com`;
const password = randomBytes(24).toString("hex");
let child, userId, caseId, cookie, captured;
const mock = `
  let n = 0, original;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Destino inesperado');
    n++;
    const payload = JSON.parse(options.body), text = payload.contents[0].parts[0].text;
    const pdf = payload.contents[0].parts[1].inlineData.data;
    if (!original) original = pdf;
    if (pdf !== original || !text.includes('Consulta original ficticia')) throw new Error('Falta documento o consulta');
    if (!payload.systemInstruction.parts[0].text.includes('No vuelvas a pedir como desconocido')) throw new Error('Falta instrucción de actualización');
    if (n === 2) {
      process.send('context-captured');
      await new Promise(resolve => process.once('message', resolve));
    }
    if (n >= 3 && n <= 5) return { ok: false, status: 503, json: async () => ({ error: { code: 503, status: 'UNAVAILABLE', message: 'Temporary failure' } }) };
    const company = text.includes('EMTRAFESA ficticia'), date = text.includes('15 de octubre de 2026');
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      summary: company ? 'El cliente declara EMTRAFESA ficticia.' + (date ? ' Fecha declarada: 15 de octubre de 2026.' : '') : 'Consulta ficticia sin aclaraciones.',
      specialty: 'Laboral', document_type: 'Consulta ficticia', readable: true,
      findings: [], dates: [], missing_information: company ? ['Acreditar documentalmente la razón social declarada.'] : ['Identificar a la empleadora.']
    }) }] } }] }) };
  };
  await import('./src/index.js');
`;
async function req(path, method = "GET", body, auth = true) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}
async function documents() {
  const response = await req(`/cases/${caseId}/documents`);
  assert.equal(response.status, 200);
  return (await response.json())[0];
}
async function answer(questions, text) {
  const created = await req(`/cases/${caseId}/clarifications`, "POST", {
    questions,
  });
  assert.equal(created.status, 201);
  const link = await created.json();
  const saved = await req(
    "/clarifications/answer",
    "POST",
    { token: link.token, answer: text, consent: true },
    false,
  );
  assert.equal(saved.status, 200);
  return link.id;
}
try {
  child = spawn(process.execPath, ["--input-type=module", "-e", mock], {
    env: {
      ...process.env,
      PORT: "3002",
      GEMINI_API_KEY: "test-only",
      MAIL_MODE: "preview",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  captured = new Promise((resolve) => child.once("message", resolve));
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
  const [user] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'gerencia')",
    ["Prueba de contexto", email, await bcrypt.hash(password, 12)],
  );
  userId = user.insertId;
  const login = await req("/login", "POST", { email, password }, false);
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie").split(";")[0];
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Consulta laboral ficticia sin empresa identificada.");
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Cliente ficticio",
    document: "12345678",
    email,
    phone: "999999999",
    description: "Consulta original ficticia por despido laboral.",
    consent: "true",
  }))
    form.set(key, value);
  form.set("attachment", new Blob([await pdf.save()]), "consulta-ficticia.pdf");
  const submitted = await req("/cases", "POST", form, false);
  assert.equal(submitted.status, 201);
  caseId = (await submitted.json()).id;
  let doc = await documents();
  assert.equal(doc.analysis_status, "analyzed");
  assert.equal(doc.analysis_context.source, "initial");
  assert.equal(doc.analysis_context.clarifications.length, 0);
  assert.equal(doc.analysis_outdated, false);

  const first = await answer(
    "¿Cuál es la razón social de la empresa?",
    "La empleadora es EMTRAFESA ficticia.",
  );
  doc = await documents();
  assert.equal(doc.analysis_outdated, true);
  assert.equal(doc.new_clarifications_count, 1);
  const analyzing = req(`/documents/${doc.id}/analyze`, "POST");
  assert.equal(
    await Promise.race([captured, delay(5000, "timeout")]),
    "context-captured",
  );
  const second = await answer(
    "¿En qué fecha ocurrió el cese laboral?",
    "El cese fue el 15 de octubre de 2026.",
  );
  child.send("continue");
  assert.equal((await analyzing).status, 200);
  doc = await documents();
  assert.deepEqual(
    doc.analysis_context.clarifications.map((r) => r.id),
    [first],
  );
  assert.match(doc.analysis.summary, /EMTRAFESA ficticia/);
  assert.equal(doc.analysis_outdated, true);
  assert.equal(doc.new_clarifications_count, 1);
  const saved = JSON.stringify({
    analysis: doc.analysis,
    context: doc.analysis_context,
    at: doc.analyzed_at,
  });

  assert.equal((await req(`/documents/${doc.id}/analyze`, "POST")).status, 503);
  doc = await documents();
  assert.equal(
    JSON.stringify({
      analysis: doc.analysis,
      context: doc.analysis_context,
      at: doc.analyzed_at,
    }),
    saved,
  );
  assert.equal(doc.analysis_outdated, true);
  assert.equal(doc.failure_reason, "provider_unavailable");

  assert.equal((await req(`/documents/${doc.id}/analyze`, "POST")).status, 200);
  doc = await documents();
  assert.deepEqual(
    doc.analysis_context.clarifications.map((r) => r.id).sort((a, b) => a - b),
    [first, second],
  );
  assert.equal(doc.analysis_context.total_answered, 2);
  assert.equal(doc.analysis_outdated, false);
  assert.equal(doc.failure_reason, null);
  assert.match(doc.analysis.summary, /15 de octubre de 2026/);
  assert.deepEqual(doc.analysis.missing_information, [
    "Acreditar documentalmente la razón social declarada.",
  ]);
  const events = (
    await (await req(`/cases/${caseId}/history`)).json()
  ).events.filter((e) => e.action === "document.analyzed");
  assert.equal(events.length, 4);
  assert.equal(events.filter((e) => e.has_version).length, 3);
  const original = await (
    await req(`/cases/${caseId}/history/${events.at(-1).id}/version`)
  ).json();
  assert.equal(original.payload.analysis_context.source, "initial");
  assert.equal(original.payload.analysis_context.clarifications.length, 0);
  const latest = await (
    await req(`/cases/${caseId}/history/${events[0].id}/version`)
  ).json();
  assert.equal(
    latest.payload.analysis_context.clarifications[0].answer,
    "La empleadora es EMTRAFESA ficticia.",
  );
  await db.execute("UPDATE documents SET analysis_context=NULL WHERE id=?", [
    doc.id,
  ]);
  doc = await documents();
  assert.equal(doc.analysis_context, null);
  assert.equal(doc.analysis_outdated, true);
  assert.equal(
    (await req(`/cases/${caseId}/documents`, "GET", null, false)).status,
    401,
  );
  console.log(
    "Analysis context smoke OK: análisis inicial automático, respuestas reales enviadas al reanalizar, respuesta concurrente pendiente, fallo conserva contexto/análisis, versiones independientes y datos antiguos sin contexto inventado.",
  );
} finally {
  child?.kill();
  if (caseId) {
    for (const table of ["clarifications", "documents", "case_events", "cases"])
      await db.execute(
        `DELETE FROM ${table} WHERE ${table === "cases" ? "id" : "case_id"}=?`,
        [caseId],
      );
  }
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  await db.end();
}
