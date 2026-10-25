import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  validateDocument,
  analyzeDocument,
  MAX_DOCUMENT_BYTES,
} from "../src/documents.js";
async function pdf(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return Buffer.from(await doc.save());
}
const sample = {
  summary: "Contrato de arrendamiento con fecha de firma.",
  specialty: "Civil",
  document_type: "Contrato",
  readable: true,
  findings: [{ detail: "Contrato de arrendamiento.", page: 1 }],
  dates: [{ text: "10 de enero de 2026", context: "Fecha de firma.", page: 1 }],
  missing_information: ["No se adjunta constancia de pago."],
};
const mock = (analysis) => async () => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }],
  }),
});
test("valida PDF por contenido, limita páginas y sanea nombre", async () => {
  const document = await validateDocument({
    originalname: "../contrato.pdf",
    buffer: await pdf(),
  });
  assert.equal(document.mime, "application/pdf");
  assert.equal(document.pages, 1);
  assert.equal(document.name, ".._contrato.pdf");
  await assert.rejects(
    validateDocument({ originalname: "largo.pdf", buffer: await pdf(51) }),
    /50 páginas/,
  );
});
test("rechaza vacíos, sobredimensionados, ejecutables y PDF corrupto", async () => {
  for (const buffer of [
    Buffer.alloc(0),
    Buffer.alloc(MAX_DOCUMENT_BYTES + 1),
    Buffer.from("MZ fake PDF"),
    Buffer.from("%PDF-1.7\ncorrupto"),
  ])
    await assert.rejects(
      validateDocument({ originalname: "documento.pdf", buffer }),
    );
});
test("admite PNG por firma sin confiar en extensión ni MIME del cliente", async () => {
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const document = await validateDocument({
    originalname: "imagen.bin",
    mimetype: "text/html",
    buffer,
  });
  assert.equal(document.mime, "image/png");
});
test("análisis envía archivo y consulta y valida referencias, sin crear plazos", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const document = { buffer: await pdf(), mime: "application/pdf", pages: 1 };
    let sent;
    const result = await analyzeDocument(
      document,
      "Consulta civil",
      async (url, options) => {
        sent = JSON.parse(options.body);
        return mock(sample)();
      },
    );
    assert.equal(result.status, "analyzed");
    assert.deepEqual(result.analysis, sample);
    assert.equal(
      sent.contents[0].parts[1].inlineData.mimeType,
      "application/pdf",
    );
    assert.equal(
      sent.contents[0].parts[1].inlineData.data,
      document.buffer.toString("base64"),
    );
    assert.match(sent.systemInstruction.parts[0].text, /No calcules plazos/);
    for (const invalid of [
      { ...sample, specialty: "Penal" },
      { ...sample, dates: [{ ...sample.dates[0], page: 2 }] },
      { ...sample, readable: false },
      { summary: "incompleto" },
    ])
      assert.equal(
        (await analyzeDocument(document, "consulta", mock(invalid))).status,
        "unavailable",
      );
    assert.equal(
      (await analyzeDocument(document, "consulta", async () => ({ ok: false })))
        .reason,
      "provider_error",
    );
    assert.equal(
      (
        await analyzeDocument(document, "consulta", async () => {
          throw new Error("timeout");
        })
      ).status,
      "unavailable",
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
test("sin clave no contacta Gemini", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await analyzeDocument({}, "consulta", () => {
      throw new Error("No debe llamarse");
    });
    assert.equal(result.reason, "missing_key");
    assert.equal(result.analysis, null);
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});
