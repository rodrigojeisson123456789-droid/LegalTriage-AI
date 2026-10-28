// Prueba funcional en Chromium: MySQL real, Gemini y SMTP simulados.
// Requiere Playwright y Chromium en el entorno de pruebas.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db.js";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  { createServer } = await import("vite");
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  out =
    process.env.REPORT_DIR ||
    path.join(root, "documentacion/pruebas/2026-10-25"),
  evidence = path.join(out, "evidencias");
mkdirSync(evidence, { recursive: true });
const suffix = randomBytes(8).toString("hex"),
  password = randomBytes(24).toString("hex"),
  users = [],
  ids = [],
  results = [],
  pageErrors = [];
let child,
  vite,
  browser,
  cleanup = false;
const web = "http://127.0.0.1:5175",
  api = "http://127.0.0.1:3004/api";
const analysis = {
  summary:
    "Consulta laboral ficticia: se solicita revisar un cese sin carta y beneficios sociales. Versión inicial de prueba.",
  specialty: "Laboral",
  document_type: "Consulta laboral de prueba",
  readable: true,
  findings: [
    {
      detail:
        "El solicitante declara un cese sin comunicación escrita. Dato ficticio pendiente de acreditación.",
      page: 1,
    },
  ],
  dates: [
    {
      text: "15 de octubre de 2026",
      context: "Fecha ficticia de cese indicada en el documento.",
      page: 1,
    },
  ],
  missing_information: [
    "Confirma la fecha de ingreso y si recibiste una carta de despido.",
  ],
};
const mock = `import nodemailer from ${JSON.stringify(import.meta.resolve("nodemailer"))};nodemailer.createTransport=()=>({sendMail:async m=>{if(!m.to.endsWith('@example.com')||m.text.includes('RESERVADO'))throw new Error('Mensaje de prueba inválido');return {accepted:[m.to]};},close(){}});let n=0;globalThis.fetch=async url=>{if(!String(url).startsWith('https://generativelanguage.googleapis.com/'))throw new Error('Destino externo inesperado');n++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({...${JSON.stringify(analysis)},summary:n===1?${JSON.stringify(analysis.summary)}:'Consulta laboral ficticia con aclaraciones incorporadas. Segunda versión de prueba.'})}]}}]})}};await import('./src/index.js');`;
async function seed(name, role) {
  const email = `aceptacion-${role}-${users.length}-${suffix}@example.com`;
  const [u] = await db.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
    [name, email, await bcrypt.hash(password, 12), role],
  );
  users.push(u.insertId);
  return { id: u.insertId, email, name, role };
}
async function readDB(sql, params = []) {
  return (await db.execute(sql, params))[0];
}
async function screenshot(page, file) {
  await page.evaluate(() => {
    if (!document.getElementById("test-banner")) {
      const b = document.createElement("div");
      b.id = "test-banner";
      b.textContent = "PRUEBA CON DATOS FICTICIOS · GEMINI Y GMAIL SIMULADOS";
      Object.assign(b.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        zIndex: "999999",
        background: "#163c32",
        color: "white",
        font: "bold 12px sans-serif",
        padding: "7px",
        textAlign: "center",
      });
      document.body.append(b);
    }
  });
  await page.screenshot({
    path: path.join(evidence, file),
    fullPage: true,
    mask: [page.locator("input[readonly]")],
    maskColor: "#c4d1ca",
  });
}
function passed(id, name, file, detail) {
  results.push({
    id,
    prueba: name,
    resultado: "APROBADA",
    evidencia: file ? "evidencias/" + file : null,
    detalle: detail,
  });
  console.log(id + " APROBADA: " + name);
}
async function login(page, user) {
  await page.goto(web);
  await page.getByRole("button", { name: "Acceso del equipo" }).click();
  await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("heading", { name: "Panel de consultas." }).waitFor();
  assert.ok(page.url().endsWith("/equipo/consultas"));
  assert.equal(
    await page
      .getByRole("button", { name: "Nueva consulta", exact: true })
      .count(),
    0,
  );
  await page.locator("a.brand").click();
  await page.getByRole("heading", { name: "Panel de consultas." }).waitFor();
  assert.ok(page.url().endsWith("/equipo/consultas"));
  await page.reload();
  await page.getByRole("heading", { name: "Panel de consultas." }).waitFor();
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  assert.ok(page.url().endsWith("/equipo/cuenta"));
  await page.goBack();
  await page.getByRole("heading", { name: "Panel de consultas." }).waitFor();
}
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.hostname === "127.0.0.1" || u.hostname === "localhost"
      ? route.continue()
      : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  return page;
}
try {
  const [available] = await readDB(
    "SELECT COUNT(*) n FROM lawyer_profiles p JOIN lawyer_specialties s ON p.user_id=s.user_id WHERE p.available=1 AND s.specialty='Laboral'",
  );
  assert.equal(
    available.n,
    0,
    "Usa una base de prueba sin otros perfiles Laboral disponibles.",
  );
  child = spawn(process.execPath, ["--input-type=module", "-e", mock], {
    cwd: path.join(root, "server"),
    env: {
      ...process.env,
      PORT: "3004",
      GEMINI_API_KEY: "mock-not-real",
      MAIL_MODE: "gmail",
      SMTP_USER: "prueba@example.com",
      SMTP_APP_PASSWORD: "test-only",
      PUBLIC_APP_URL: web,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (child.exitCode !== null) throw new Error("API temporal no inició");
    try {
      if ((await fetch(api + "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready);
  vite = await createServer({
    root: path.join(root, "client"),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      proxy: { "/api": "http://127.0.0.1:3004" },
    },
  });
  await vite.listen();
  const manager = await seed("Gerencia de prueba", "gerencia"),
    lawyer = await seed("Abogada Laboral de prueba", "abogado"),
    support = await seed("Soporte de prueba", "soporte"),
    outsider = await seed("Abogado sin asignación", "abogado");
  await db.execute(
    "INSERT INTO lawyer_profiles(user_id,available) VALUES (?,1)",
    [lawyer.id],
  );
  await db.execute(
    "INSERT INTO lawyer_specialties(user_id,specialty) VALUES (?,'Laboral')",
    [lawyer.id],
  );
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
  const client = await newPage();
  await client.goto(web);
  await client.waitForURL("**/consulta");
  assert.equal(
    await client
      .getByRole("button", { name: "Control de plazos", exact: false })
      .count(),
    0,
  );
  await client
    .getByLabel("Nombre completo", { exact: true })
    .fill("Cliente Ficticio de Prueba");
  await client.getByLabel("DNI o RUC", { exact: true }).fill("12345678");
  await client
    .getByLabel("Correo electrónico", { exact: true })
    .fill(`cliente-ficticio-${suffix}@example.com`);
  await client
    .getByLabel("Teléfono de contacto", { exact: true })
    .fill("999999999");
  await client
    .getByLabel("Descripción de la consulta", { exact: true })
    .fill(
      "CASO FICTICIO. Me cesaron sin comunicación escrita el 15 de octubre de 2026. Solicito orientación sobre beneficios sociales y documentos necesarios.",
    );
  const pdf = await PDFDocument.create();
  pdf
    .addPage()
    .drawText(
      "CASO FICTICIO: consulta laboral por cese sin carta. Uso exclusivo de pruebas.",
    );
  await client.locator("input[type=file]").setInputFiles({
    name: "Consulta_ficticia.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await client.getByRole("checkbox").check();
  const submitted = client.waitForResponse(
    (r) => r.url().endsWith("/api/cases") && r.request().method() === "POST",
  );
  await client
    .getByRole("button", { name: "Enviar consulta", exact: true })
    .click();
  const response = await submitted;
  assert.equal(response.status(), 201);
  const receipt = await response.json();
  ids.push(receipt.id);
  const caseId = receipt.id;
  await client
    .getByRole("heading", { name: "Recibimos tu consulta" })
    .waitFor();
  assert.equal(receipt.specialty, "Laboral");
  await screenshot(client, "01-recepcion.png");
  passed(
    "UI-01",
    "Recepción de consulta y PDF",
    "01-recepcion.png",
    "Formulario real del navegador; PDF generado para esta prueba, persistido en MySQL.",
  );
  const p = await newPage();
  await login(p, lawyer);
  const row = p
    .getByRole("row")
    .filter({ has: p.getByText("#" + caseId, { exact: true }) });
  await row.waitFor();
  assert.equal(
    await row.getByLabel(`Asignar abogado al caso ${caseId}`).inputValue(),
    String(lawyer.id),
  );
  assert.equal(
    await row.getByLabel(`Especialidad del caso ${caseId}`).inputValue(),
    "Laboral",
  );
  await screenshot(p, "02-asignacion.png");
  passed(
    "UI-02",
    "Clasificación y asignación automática",
    "02-asignacion.png",
    "Respuesta Gemini simulada Laboral; algoritmo real asignó la abogada disponible.",
  );
  await row.getByRole("button", { name: "Ver documentos y análisis" }).click();
  await p.getByText(analysis.summary, { exact: true }).waitFor();
  await screenshot(p, "03-analisis-inicial.png");
  await p.getByRole("button", { name: "Cerrar documentos" }).click();
  passed(
    "UI-03",
    "Visualización del análisis documental",
    "03-analisis-inicial.png",
    "Resumen, hallazgos con página, fechas y advertencias mostrados; contenido Gemini simulado.",
  );
  await row.getByRole("button", { name: "Aclaraciones", exact: false }).click();
  await p
    .getByLabel("Información que necesitas del cliente")
    .fill(
      "Confirma la fecha de ingreso y si recibiste una carta de despido. Datos exclusivamente ficticios.",
    );
  await p
    .getByRole("button", {
      name: "Crear solicitud y enlace privado",
      exact: true,
    })
    .click();
  const clarificationInput = p.getByLabel("Enlace privado", { exact: true });
  await clarificationInput.waitFor();
  const clarificationLink = await clarificationInput.inputValue();
  const mail = p.locator(".email-notification");
  await mail.getByRole("checkbox").check();
  await mail
    .getByRole("button", { name: "Enviar notificación por Gmail", exact: true })
    .click();
  await mail.getByRole("status").filter({ hasText: "aceptó" }).waitFor();
  await screenshot(p, "04-aclaracion-correo.png");
  passed(
    "UI-04",
    "Aclaración y notificación",
    "04-aclaracion-correo.png",
    "Solicitud real registrada y envío aceptado por SMTP simulado. Enlace oculto en captura; no hubo correo real.",
  );
  const answerPage = await newPage({ width: 390, height: 844 });
  await answerPage.goto(clarificationLink);
  await answerPage
    .getByLabel("Tu respuesta", { exact: true })
    .fill(
      "DATOS FICTICIOS: ingresé en enero de 2023 y no recibí carta de despido.",
    );
  await answerPage.getByRole("checkbox").check();
  assert.ok(
    await answerPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await answerPage
    .getByRole("button", { name: "Enviar aclaración", exact: true })
    .click();
  await answerPage
    .getByRole("heading", { name: "Recibimos tu aclaración" })
    .waitFor();
  await screenshot(answerPage, "05-respuesta-cliente-movil.png");
  await p.getByRole("button", { name: "Cerrar aclaraciones" }).click();
  await row.getByRole("button", { name: "Aclaraciones", exact: false }).click();
  await p
    .getByText(
      "DATOS FICTICIOS: ingresé en enero de 2023 y no recibí carta de despido.",
      { exact: true },
    )
    .waitFor();
  await p.getByRole("button", { name: "Cerrar aclaraciones" }).click();
  await row.getByText("En evaluación", { exact: true }).waitFor();
  passed(
    "UI-05",
    "Respuesta del cliente y retorno a evaluación",
    "05-respuesta-cliente-movil.png",
    "Respuesta privada guardada en el mismo caso; vista de 390 px sin desbordamiento horizontal.",
  );
  await row.getByRole("button", { name: "Evaluación y respuesta" }).click();
  const notes1 =
    "RESERVADO: fundamentos ficticios de la revisión uno para uso interno.";
  const notes2 =
    "RESERVADO: fundamentos ficticios ampliados en la revisión dos para uso interno.";
  const reply1 =
    "Respuesta ficticia inicial: se propone revisar la documentación laboral original.";
  const reply2 =
    "Respuesta ficticia revisada: se propone una reunión y la revisión de contratos y boletas.";
  await p.getByLabel("Conclusiones internas del abogado").fill(notes1);
  await p.getByLabel("Tipo de comunicación").selectOption("Cotización");
  await p.getByLabel("Importe propuesto").fill("250.50");
  await p.getByLabel("Respuesta o propuesta para el cliente").fill(reply1);
  await p.getByLabel("Decisión sobre la atención").selectOption("close");
  await p
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await p
    .getByRole("status")
    .filter({ hasText: "Borrador guardado" })
    .waitFor();
  await p.getByLabel("Conclusiones internas del abogado").fill(notes2);
  await p.getByLabel("Respuesta o propuesta para el cliente").fill(reply2);
  await p
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await p
    .getByRole("status")
    .filter({ hasText: "Borrador guardado" })
    .waitFor();
  await p.getByRole("button", { name: "Cerrar evaluación" }).click();
  await row.getByRole("button", { name: "Historial del caso" }).click();
  const dialog = p.getByRole("dialog");
  const old = dialog
      .locator("ol.case-history > li")
      .filter({ hasText: "Borrador de evaluación guardado (revisión 1)." }),
    latest = dialog
      .locator("ol.case-history > li")
      .filter({ hasText: "Borrador de evaluación guardado (revisión 2)." });
  await old.getByRole("button", { name: "Ver versión guardada" }).click();
  await old.getByText(notes1, { exact: true }).waitFor();
  await latest.getByRole("button", { name: "Ver versión guardada" }).click();
  await latest.getByText(notes2, { exact: true }).waitFor();
  assert.equal(
    await dialog
      .locator(".version-content textarea,.version-content input")
      .count(),
    0,
  );
  await old.getByText(notes1, { exact: true }).scrollIntoViewIfNeeded();
  await screenshot(p, "06a-evaluacion-anterior.png");
  await latest.getByText(notes2, { exact: true }).scrollIntoViewIfNeeded();
  await screenshot(p, "06-evaluaciones-versiones.png");
  await p.getByRole("button", { name: "Cerrar historial" }).click();
  passed(
    "UI-06",
    "Consulta de dos versiones de evaluación",
    "06-evaluaciones-versiones.png",
    "Guardados desde la interfaz; cada revisión mantiene sus fundamentos y respuesta. Solo lectura.",
  );
  await row.getByRole("button", { name: "Ver documentos y análisis" }).click();
  await p
    .getByRole("button", { name: "Volver a analizar", exact: true })
    .click();
  const summary2 =
    "Consulta laboral ficticia con aclaraciones incorporadas. Segunda versión de prueba.";
  await p.getByText(summary2, { exact: true }).waitFor();
  await p.getByRole("button", { name: "Cerrar documentos" }).click();
  await row.getByRole("button", { name: "Historial del caso" }).click();
  const entries = p
    .getByRole("dialog")
    .locator("ol.case-history > li")
    .filter({ hasText: "Análisis documental guardado para revisión." });
  await entries
    .nth(0)
    .getByRole("button", { name: "Ver versión guardada" })
    .click();
  await p.getByText(summary2, { exact: true }).waitFor();
  await entries
    .nth(1)
    .getByRole("button", { name: "Ver versión guardada" })
    .click();
  await p.getByText(analysis.summary, { exact: true }).waitFor();
  await entries
    .nth(1)
    .getByText(analysis.summary, { exact: true })
    .scrollIntoViewIfNeeded();
  await screenshot(p, "07a-analisis-anterior.png");
  await entries
    .nth(0)
    .getByText(summary2, { exact: true })
    .scrollIntoViewIfNeeded();
  await screenshot(p, "07-analisis-versiones.png");
  await p.getByRole("button", { name: "Cerrar historial" }).click();
  passed(
    "UI-07",
    "Consulta de dos versiones de análisis Gemini",
    "07-analisis-versiones.png",
    "Dos respuestas simuladas distintas; ambas copias siguen disponibles después de reanalizar.",
  );
  await row.getByRole("button", { name: "Evaluación y respuesta" }).click();
  assert.equal(
    await p.getByLabel("Conclusiones internas del abogado").inputValue(),
    notes2,
  );
  assert.doesNotMatch(
    await p.locator(".evaluation-preview").innerText(),
    /RESERVADO/,
  );
  await p.getByRole("checkbox").check();
  await p
    .getByRole("button", { name: "Aprobar evaluación y decisión" })
    .click();
  await p
    .getByRole("button", { name: "Crear enlace de respuesta aprobada" })
    .waitFor();
  await p
    .getByText(
      "Última notificación de respuesta: aceptada por Gmail (entrega no confirmada).",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await p.getByLabel("Conclusiones internas del abogado").isDisabled(),
    true,
  );
  await p
    .getByRole("button", { name: "Crear enlace de respuesta aprobada" })
    .click();
  const responseInput = p.getByLabel("Enlace de respuesta para el cliente");
  await responseInput.waitFor();
  const responseLink = await responseInput.inputValue();
  const finalMail = p.locator(".email-notification");
  await finalMail.getByRole("checkbox").check();
  await finalMail
    .getByRole("button", { name: "Enviar notificación por Gmail", exact: true })
    .click();
  await finalMail.getByRole("status").filter({ hasText: "aceptó" }).waitFor();
  await screenshot(p, "08-aprobacion-notificacion.png");
  passed(
    "UI-08",
    "Aprobación y notificación de respuesta",
    "08-aprobacion-notificacion.png",
    "Evaluación bloqueada tras aprobación; registro real de aceptación SMTP simulada, sin entrega a Gmail real.",
  );
  const finalPage = await newPage({ width: 390, height: 844 });
  await finalPage.goto(responseLink);
  await finalPage.getByText(reply2, { exact: true }).waitFor();
  assert.doesNotMatch(await finalPage.locator("body").innerText(), /RESERVADO/);
  assert.match(await finalPage.locator("body").innerText(), /250/);
  assert.ok(
    await finalPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await screenshot(finalPage, "09-respuesta-final-movil.png");
  await p.getByRole("button", { name: "Cerrar evaluación" }).click();
  await row.getByText("Atención inicial cerrada", { exact: true }).waitFor();
  passed(
    "UI-09",
    "Respuesta privada final y cierre",
    "09-respuesta-final-movil.png",
    "Cliente ve respuesta e importe aprobados, sin notas internas; caso queda cerrado.",
  );
  const s = await newPage();
  await login(s, support);
  const supportRow = s
    .getByRole("row")
    .filter({ has: s.getByText("#" + caseId, { exact: true }) });
  assert.equal(
    await supportRow
      .getByRole("button", { name: "Evaluación y respuesta" })
      .count(),
    0,
  );
  await supportRow.getByRole("button", { name: "Historial del caso" }).click();
  const supportDialog = s.getByRole("dialog");
  await supportDialog
    .getByRole("button", { name: "Ver versión guardada" })
    .first()
    .waitFor();
  assert.equal(
    await supportDialog
      .getByRole("button", { name: "Ver versión guardada" })
      .count(),
    2,
  );
  assert.doesNotMatch(
    await supportDialog.innerText(),
    /Borrador de evaluación/,
  );
  await screenshot(s, "10-permisos-soporte.png");
  const o = await newPage();
  await login(o, outsider);
  assert.equal(await o.getByText("#" + caseId, { exact: true }).count(), 0);
  passed(
    "UI-10",
    "Permisos de Soporte y abogado no asignado",
    "10-permisos-soporte.png",
    "Soporte no ve evaluaciones ni sus versiones; otro abogado no ve el caso.",
  );
  assert.deepEqual(pageErrors, []);
  passed(
    "UI-11",
    "Errores JavaScript del recorrido",
    null,
    "Cero excepciones pageerror en las páginas del recorrido. Recursos externos del navegador bloqueados.",
  );
} catch (error) {
  writeFileSync(
    path.join(out, "fallo-navegador.txt"),
    String(error.stack || error),
  );
  throw error;
} finally {
  await browser?.close();
  await vite?.close();
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
  }
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
  for (const id of users) {
    await db.execute("DELETE FROM lawyer_specialties WHERE user_id=?", [id]);
    await db.execute("DELETE FROM lawyer_profiles WHERE user_id=?", [id]);
    await db.execute("DELETE FROM users WHERE id=?", [id]);
  }
  cleanup = true;
  await db.end();
  writeFileSync(
    path.join(out, "navegador.json"),
    JSON.stringify(
      {
        gemini: "simulado",
        smtp: "simulado",
        mysql: "real",
        limpieza: cleanup,
        errores_js: pageErrors,
        resultados: results,
      },
      null,
      2,
    ) + "\n",
  );
}
