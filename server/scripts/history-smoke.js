// MySQL real y API temporal, sin Gemini ni correo externos. Limpia sus fixtures.
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db.js";
import { recordEvent } from "../src/history.js";
const base = "http://127.0.0.1:3002/api",
  suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex"),
  users = [],
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
async function account(role) {
  const email = `${role}-${suffix}@example.com`;
  const [u] = await db.execute(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    [role + " prueba", email, await bcrypt.hash(password, 12), role],
  );
  users.push(u.insertId);
  const login = await req(null, "/login", "POST", { email, password });
  return {
    id: u.insertId,
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
    lawyer = await account("abogado");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const form = new FormData();
  for (const [k, v] of Object.entries({
    name: "Cliente prueba",
    document: "12345678",
    email: suffix + "@example.com",
    phone: "999999999",
    description: "Consulta ficticia sobre contrato y beneficios laborales.",
    consent: "true",
  }))
    form.set(k, v);
  form.set("attachment", new Blob([await pdf.save()]), "datos-privados.pdf");
  const created = await req(null, "/cases", "POST", form);
  assert.equal(created.status, 201);
  const id = (await created.json()).id;
  ids.push(id);
  const path = `/cases/${id}/history`;
  assert.equal((await req(null, path)).status, 401);
  assert.equal((await req(lawyer.cookie, path)).status, 404);
  let first = await (await req(manager.cookie, path)).json();
  assert.ok(
    first.events.some(
      (e) => e.action === "case.created" && e.actor_type === "cliente",
    ),
  );
  assert.ok(first.events.some((e) => e.action === "document.received"));
  assert.ok(first.events.some((e) => e.action === "document.analyzed"));
  assert.equal(
    (
      await req(manager.cookie, `/cases/${id}`, "PATCH", {
        lawyer_id: lawyer.id,
        specialty: "Laboral",
        status: "En evaluación",
      })
    ).status,
    204,
  );
  const clarification = await (
    await req(support.cookie, `/cases/${id}/clarifications`, "POST", {
      questions: "PREGUNTA_PRIVADA: confirma la fecha de inicio laboral.",
    })
  ).json();
  assert.equal(
    (
      await req(null, "/clarifications/answer", "POST", {
        token: clarification.token,
        answer: "RESPUESTA_PRIVADA: empecé a trabajar en enero de 2023.",
        consent: true,
      })
    ).status,
    200,
  );
  const draft = {
    expected_revision: 0,
    notes:
      "NOTAS_PRIVADAS: conclusión del abogado solo para evaluación interna.",
    reply_type: "Respuesta",
    reply_text:
      "TEXTO_PRIVADO: respuesta aprobada para el cliente del estudio.",
    amount: null,
    decision: "judicial",
  };
  assert.equal(
    (await req(lawyer.cookie, `/cases/${id}/evaluation`, "PUT", draft)).status,
    200,
  );
  assert.equal(
    (
      await req(lawyer.cookie, "/deadlines", "POST", {
        case_id: id,
        title: "TITULO_PRIVADO",
        due_at: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req(lawyer.cookie, `/cases/${id}/evaluation/approve`, "POST", {
        expected_revision: 1,
        confirmed: true,
      })
    ).status,
    200,
  );
  const link = await (
    await req(lawyer.cookie, `/cases/${id}/evaluation/share`, "POST")
  ).json();
  const legal = await (await req(lawyer.cookie, path)).json(),
    clerical = await (await req(support.cookie, path)).json();
  assert.ok(legal.events.some((e) => e.action === "evaluation.saved"));
  assert.ok(
    !clerical.events.some((e) =>
      ["evaluation.saved", "response.link_created"].includes(e.action),
    ),
  );
  assert.ok(legal.events.some((e) => e.action === "evaluation.approved"));
  assert.ok(legal.events.some((e) => e.action === "assignment.manual"));
  assert.ok(
    legal.events.some(
      (e) =>
        e.action === "clarification.answered" && e.actor_type === "cliente",
    ),
  );
  const text = JSON.stringify(legal);
  for (const secret of [
    "NOTAS_PRIVADAS",
    "TEXTO_PRIVADO",
    "PREGUNTA_PRIVADA",
    "RESPUESTA_PRIVADA",
    "TITULO_PRIVADO",
    "datos-privados.pdf",
    password,
    link.token,
    clarification.token,
  ])
    assert.equal(text.includes(secret), false, secret);
  const countBefore = legal.events.length;
  assert.equal((await req(manager.cookie, path, "DELETE")).status, 404);
  assert.equal(
    (await req(manager.cookie, `/cases/${id}`, "PATCH", { status: "Nuevo" }))
      .status,
    409,
  );
  assert.equal(
    (await (await req(manager.cookie, path)).json()).events.length,
    countBefore,
  );
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE cases SET description=? WHERE id=?", [
      "Cambio que no debe persistir",
      id,
    ]);
    await recordEvent(connection, id, "case.status_changed", null, {
      previous: "Nuevo",
      status: "En evaluación",
    });
    await connection.rollback();
  } finally {
    connection.release();
  }
  assert.equal(
    (await (await req(manager.cookie, path)).json()).events.length,
    countBefore,
  );
  // Volumen de prueba solo para comprobar cursores y separación entre páginas.
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    for (let n = 0; n < 60; n++)
      await recordEvent(c, id, "case.status_changed", null, {
        previous: "Nuevo",
        status: "En evaluación",
      });
    await c.commit();
  } finally {
    c.release();
  }
  const page1 = await (await req(support.cookie, path)).json();
  assert.equal(page1.events.length, 50);
  assert.ok(page1.next_cursor);
  const page2 = await (
    await req(support.cookie, path + "?before=" + page1.next_cursor)
  ).json();
  assert.ok(page2.events.length > 0);
  assert.equal(
    new Set([...page1.events, ...page2.events].map((e) => e.id)).size,
    page1.events.length + page2.events.length,
  );
  assert.equal(
    (await req(manager.cookie, path + "?before=incorrecto")).status,
    400,
  );
  console.log(
    "History smoke OK: actores, acciones reales, permisos por caso/rol, metadatos sin secretos ni notas, sin edición API, rollback y paginación.",
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
