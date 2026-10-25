// MySQL de prueba y Gemini simulado. No contacta servicios externos.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db.js";
const base = "http://127.0.0.1:3002/api",
  suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex"),
  ids = [],
  users = [];
let child;
const analysis = {
  summary: "Análisis ficticio inicial",
  specialty: "Laboral",
  document_type: "Consulta laboral",
  readable: true,
  findings: [{ detail: "Hecho ficticio que requiere validación.", page: 1 }],
  dates: [],
  missing_information: [],
};
const mock = `let n=0;globalThis.fetch=async(url)=>{if(!String(url).startsWith('https://generativelanguage.googleapis.com/'))throw new Error('Destino inesperado');n++;if(n===3)return {ok:false,status:503,json:async()=>({})};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({...${JSON.stringify(analysis)},summary:'Análisis ficticio '+n})}]}}]})}};await import('./src/index.js');`;
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
async function account(role) {
  const email = `versions-${role}-${users.length}-${suffix}@example.com`;
  const [u] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
    [role + " versiones", email, await bcrypt.hash(password, 12), role],
  );
  users.push(u.insertId);
  const login = await req(null, "/login", "POST", { email, password });
  assert.equal(login.status, 200);
  return {
    id: u.insertId,
    cookie: login.headers.get("set-cookie").split(";")[0],
  };
}
async function migrate() {
  const p = spawn(process.execPath, ["src/setup.js"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Falló migración: " + code)),
    );
  });
}
try {
  child = spawn(process.execPath, ["--input-type=module", "-e", mock], {
    env: {
      ...process.env,
      PORT: "3002",
      GEMINI_API_KEY: "mock-not-real",
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
    lawyer = await account("abogado"),
    other = await account("abogado"),
    support = await account("soporte");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const form = new FormData();
  for (const [k, v] of Object.entries({
    name: "Cliente versiones",
    document: "12345678",
    email: suffix + "@example.com",
    phone: "999999999",
    description: "Consulta laboral ficticia por cese sin aviso escrito.",
    consent: "true",
  }))
    form.set(k, v);
  form.set("attachment", new Blob([await pdf.save()]), "consulta.pdf");
  const created = await req(null, "/cases", "POST", form);
  assert.equal(created.status, 201);
  const id = (await created.json()).id;
  ids.push(id);
  const path = `/cases/${id}/history`,
    ep = `/cases/${id}/evaluation`;
  assert.equal(
    (
      await req(manager.cookie, `/cases/${id}`, "PATCH", {
        lawyer_id: lawyer.id,
      })
    ).status,
    204,
  );
  let events = (await (await req(manager.cookie, path)).json()).events;
  const initial = events.find((e) => e.action === "document.analyzed");
  assert.equal(initial.has_version, 1);
  const version = async (actor, event, caseId = id) =>
    req(actor?.cookie, `/cases/${caseId}/history/${event.id}/version`);
  assert.equal((await version(null, initial)).status, 401);
  assert.equal((await version(other, initial)).status, 404);
  const doc = (
    await (await req(manager.cookie, `/cases/${id}/documents`)).json()
  )[0];
  assert.equal(
    (await req(lawyer.cookie, `/documents/${doc.id}/analyze`, "POST")).status,
    200,
  );
  assert.equal(
    (await req(lawyer.cookie, `/documents/${doc.id}/analyze`, "POST")).status,
    503,
  );
  const draft = {
    expected_revision: 0,
    notes: "Fundamentos internos originales de la primera versión.",
    reply_type: "Respuesta",
    reply_text: "Primera respuesta ficticia para el cliente del estudio.",
    amount: null,
    decision: "close",
  };
  assert.equal((await req(lawyer.cookie, ep, "PUT", draft)).status, 200);
  assert.equal(
    (
      await req(lawyer.cookie, ep, "PUT", {
        ...draft,
        expected_revision: 1,
        notes: "Fundamentos internos modificados en la segunda versión.",
        reply_text: "Segunda respuesta ficticia revisada por el abogado.",
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(lawyer.cookie, ep, "PUT", { ...draft, expected_revision: 1 }))
      .status,
    409,
  );
  events = (await (await req(manager.cookie, path)).json()).events;
  const evals = events
    .filter((e) => e.action === "evaluation.saved")
    .sort((a, b) => a.id - b.id);
  assert.equal(evals.length, 2);
  assert.equal(
    (await (await version(lawyer, evals[0])).json()).payload.notes,
    draft.notes,
  );
  assert.equal((await version(support, evals[0])).status, 404);
  const supportEvents = (await (await req(support.cookie, path)).json()).events;
  assert.equal(
    supportEvents.some((e) => e.action === "evaluation.saved"),
    false,
  );
  const docs = events.filter((e) => e.action === "document.analyzed");
  assert.equal(docs.length, 3);
  assert.equal(docs[0].has_version, 0);
  assert.equal((await version(manager, docs[0])).status, 404);
  const original = (await (await version(support, initial)).json()).payload;
  assert.equal(original.analysis.summary, "Análisis ficticio 1");
  assert.equal(
    (await (await version(manager, docs[1])).json()).payload.analysis.summary,
    "Análisis ficticio 2",
  );
  assert.equal(
    (await (await req(lawyer.cookie, ep)).json()).evaluation.reply_text,
    "Segunda respuesta ficticia revisada por el abogado.",
  );
  assert.equal(
    (await (await req(manager.cookie, `/cases/${id}/documents`)).json())[0]
      .analysis.summary,
    "Análisis ficticio 2",
  );
  assert.equal(
    (
      await req(lawyer.cookie, ep + "/approve", "POST", {
        expected_revision: 2,
        confirmed: true,
      })
    ).status,
    200,
  );
  events = (await (await req(manager.cookie, path)).json()).events;
  const approved = events.find((e) => e.action === "evaluation.approved");
  const supportAfterApproval = (await (await req(support.cookie, path)).json())
    .events;
  assert.equal(
    supportAfterApproval.find((e) => e.action === "evaluation.approved")
      .has_version,
    0,
  );
  const approvedData = (await (await version(lawyer, approved)).json()).payload;
  assert.equal(approvedData.approved, true);
  assert.equal(approvedData.revision, 3);
  assert.equal(
    (await (await version(manager, evals[0])).json()).payload.approved,
    false,
  );
  assert.equal(
    (
      await req(manager.cookie, `${path}/${evals[0].id}/version`, "PUT", {
        notes: "alterar",
      })
    ).status,
    404,
  );
  // Contenido vigente anterior a la función: se conserva una sola vez al migrar.
  const [legacy] = await db.execute(
    "INSERT INTO cases(name,document,email,phone,description,specialty,classification_status) VALUES ('Cliente anterior','12345678',?,'999999999','Consulta ficticia antigua.','Laboral','manual')",
    [suffix + "@example.com"],
  );
  ids.push(legacy.insertId);
  await db.execute(
    "INSERT INTO evaluations(case_id,notes,reply_type,reply_text,amount,decision,revision,updated_by) VALUES (?,?,?,?,?,?,?,?)",
    [
      legacy.insertId,
      draft.notes,
      draft.reply_type,
      draft.reply_text,
      null,
      "close",
      7,
      manager.id,
    ],
  );
  await db.execute(
    "INSERT INTO documents(case_id,original_name,mime_type,page_count,content,analysis_status,analysis) VALUES (?,'anterior.pdf','application/pdf',1,?,'analyzed',?)",
    [legacy.insertId, Buffer.from(await pdf.save()), JSON.stringify(analysis)],
  );
  await migrate();
  await migrate();
  const legacyEvents = (
    await (
      await req(manager.cookie, `/cases/${legacy.insertId}/history`)
    ).json()
  ).events;
  assert.equal(legacyEvents.length, 2);
  assert.ok(legacyEvents.every((e) => e.has_version));
  assert.equal(
    (
      await (
        await version(
          manager,
          legacyEvents.find((e) => e.action === "evaluation.baseline"),
          legacy.insertId,
        )
      ).json()
    ).payload.revision,
    7,
  );
  assert.equal((await version(manager, initial, legacy.insertId)).status, 404);
  console.log(
    "Versions smoke OK: evaluaciones y análisis originales/revisados/aprobados, lectura sin alterar actual, fallos/conflictos sin versiones falsas, permisos, aislamiento y migración repetible con contenido vigente preservado.",
  );
} finally {
  child?.kill();
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
