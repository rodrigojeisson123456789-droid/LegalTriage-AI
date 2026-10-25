// Integración con MySQL real. Crea una cuenta temporal y elimina solo sus datos.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db.js";
const base = "http://127.0.0.1:3002/api";
const email = `document-smoke-${randomBytes(8).toString("hex")}@example.com`,
  password = randomBytes(24).toString("hex");
const child = spawn(process.execPath, ["src/index.js"], {
  env: { ...process.env, PORT: "3002", GEMINI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let userId;
function form(buffer, name = "contrato.pdf", consent = "true") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Cliente documento prueba",
    document: "12345678",
    email,
    phone: "+51999999999",
    description: "Necesito revisar este contrato de arrendamiento civil.",
    consent,
  }))
    data.set(key, value);
  data.set("attachment", new Blob([buffer]), name);
  return data;
}
try {
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (child.exitCode !== null) throw new Error("API no inició");
    try {
      if ((await fetch(base + "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready, "MySQL y API deben estar disponibles");
  const [user] = await db.execute(
    "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
    ["Abogado documentos prueba", email, await bcrypt.hash(password, 12)],
  );
  userId = user.insertId;
  await db.execute("UPDATE users SET role='gerencia' WHERE id=?", [userId]);
  const pdf = await PDFDocument.create();
  pdf
    .addPage()
    .drawText("Contrato de arrendamiento. Fecha de firma: 10 enero 2026.");
  const buffer = Buffer.from(await pdf.save());
  const submitted = await fetch(base + "/cases", {
    method: "POST",
    body: form(buffer),
  });
  assert.equal(submitted.status, 201);
  const record = await submitted.json();
  assert.equal(record.document_status, "unavailable");
  assert.equal(record.specialty, "Indeterminado");
  assert.equal(
    (await fetch(base + `/cases/${record.id}/documents`)).status,
    401,
  );
  const login = await fetch(base + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const rows = await (
    await fetch(base + `/cases/${record.id}/documents`, {
      headers: { Cookie: cookie },
    })
  ).json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].failure_reason, "missing_key");
  assert.equal(rows[0].original_name, "contrato.pdf");
  assert.equal(rows[0].analysis, null);
  assert.equal(rows[0].content, undefined);
  const id = rows[0].id;
  await db.execute("UPDATE documents SET failure_reason=? WHERE id=?", [
    "provider_error",
    id,
  ]);
  assert.equal((await fetch(base + `/documents/${id}/download`)).status, 401);
  assert.equal(
    (await fetch(base + `/documents/${id}/analyze`, { method: "POST" })).status,
    401,
  );
  const downloaded = await fetch(base + `/documents/${id}/download`, {
    headers: { Cookie: cookie },
  });
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers.get("content-disposition"), /^attachment/);
  assert.equal(downloaded.headers.get("content-type"), "application/pdf");
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), buffer);
  assert.equal(
    (
      await fetch(base + `/documents/${id}/analyze`, {
        method: "POST",
        headers: { Cookie: cookie },
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await fetch(base + "/cases", {
        method: "POST",
        body: form(Buffer.from("un ejecutable"), "fake.pdf"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/cases", {
        method: "POST",
        body: form(buffer, "contrato.pdf", "false"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/cases", {
        method: "POST",
        body: form(Buffer.alloc(8 * 1024 * 1024 + 1), "grande.pdf"),
      })
    ).status,
    400,
  );
  const two = form(buffer);
  two.append("attachment", new Blob([buffer]), "segundo.pdf");
  assert.equal(
    (await fetch(base + "/cases", { method: "POST", body: two })).status,
    400,
  );
  const [saved] = await db.execute(
    "SELECT COUNT(*) AS total FROM cases WHERE email=?",
    [email],
  );
  assert.equal(
    saved[0].total,
    1,
    "Los rechazos no deben crear casos parciales",
  );
  const refreshed = await (
    await fetch(base + `/cases/${record.id}/documents`, {
      headers: { Cookie: cookie },
    })
  ).json();
  assert.equal(refreshed[0].failure_reason, "missing_key");
  assert.match(refreshed[0].failure_message, /Configura GEMINI_API_KEY/);
  const previous = { summary: "Análisis anterior válido" };
  await db.execute(
    "UPDATE documents SET analysis_status=?,analysis=? WHERE id=?",
    ["analyzed", JSON.stringify(previous), id],
  );
  assert.equal(
    (
      await fetch(base + `/documents/${id}/analyze`, {
        method: "POST",
        headers: { Cookie: cookie },
      })
    ).status,
    503,
  );
  const [retained] = await db.execute(
    "SELECT analysis_status,analysis FROM documents WHERE id=?",
    [id],
  );
  assert.equal(retained[0].analysis_status, "analyzed");
  assert.deepEqual(
    typeof retained[0].analysis === "string"
      ? JSON.parse(retained[0].analysis)
      : retained[0].analysis,
    previous,
  );
  console.log(
    "Document smoke OK: PDF íntegro, acceso privado, descarga, reintento, análisis previo conservado, rechazo de formato/tamaño/consentimiento/múltiples archivos y sin registros parciales.",
  );
} finally {
  child.kill();
  await db.execute(
    "DELETE d FROM documents d JOIN cases c ON c.id=d.case_id WHERE c.email=?",
    [email],
  );
  await db.execute(
    "DELETE e FROM case_events e JOIN cases c ON c.id=e.case_id WHERE c.email=?",
    [email],
  );
  await db.execute("DELETE FROM cases WHERE email=?", [email]);
  if (userId) await db.execute("DELETE FROM users WHERE id=?", [userId]);
  await db.end();
}
