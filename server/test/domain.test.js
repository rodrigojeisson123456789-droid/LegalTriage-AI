import { test } from "node:test";
import assert from "node:assert/strict";
import {
  urgency,
  classify,
  caseSchema,
  deadlineSchema,
} from "../src/domain.js";
test("plazos: vencido, 24h y 48h inclusivos", () => {
  const now = Date.now();
  for (const [h, want] of [
    [-1, "Vencido"],
    [0, "Vencido"],
    [24, "Crítico"],
    [24.1, "Próximo"],
    [48, "Próximo"],
    [49, "Programado"],
  ])
    assert.equal(urgency(new Date(now + h * 3600000), now), want);
});
test("consulta: valida documento, consentimiento y texto", () => {
  const good = {
    name: "María García",
    document: "12345678",
    email: "maria@example.com",
    phone: "+51 999999999",
    description: "Necesito ayuda con un proceso de alimentos.",
    consent: true,
  };
  assert.ok(caseSchema.safeParse(good).success);
  for (const patch of [
    { document: "123" },
    { consent: false },
    { description: "corto" },
    { email: "no" },
  ])
    assert.equal(caseSchema.safeParse({ ...good, ...patch }).success, false);
});
test("plazo requiere fecha futura con zona horaria", () => {
  assert.equal(
    deadlineSchema.safeParse({
      case_id: 1,
      title: "Audiencia",
      due_at: "2020-01-01T00:00:00Z",
    }).success,
    false,
  );
  assert.ok(
    deadlineSchema.safeParse({
      case_id: 1,
      title: "Audiencia",
      due_at: new Date(Date.now() + 3600000).toISOString(),
    }).success,
  );
});
test("Gemini valida categoría y conserva caso cuando falla", async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    let payload;
    const good = await classify("Consulta", async (url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '"Familia"' }] } }],
        }),
      };
    });
    assert.equal(good.specialty, "Familia");
    assert.match(
      payload.systemInstruction.parts[0].text,
      /Civil, Corporativo, Familia, Bancario, Laboral, Penal o Indeterminado/,
    );
    assert.equal(
      (await classify("consulta", async () => ({ ok: false })))
        .classification_status,
      "unavailable",
    );
    assert.equal(
      (
        await classify("consulta", async () => ({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '"Tributario"' }] } }],
          }),
        }))
      ).specialty,
      "Indeterminado",
    );
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});

test("Gemini puede clasificar una consulta laboral", async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const result = await classify(
      "Me despidieron sin pagar beneficios sociales",
      async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '"Laboral"' }] } }],
        }),
      }),
    );
    assert.equal(result.specialty, "Laboral");
    assert.equal(result.classification_status, "classified");
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});

test("Gemini acepta Penal en el esquema y conserva su clasificación", async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const result = await classify(
      "Consulta penal ficticia sobre una denuncia",
      async (url, options) => {
        const sent = JSON.parse(options.body);
        assert.ok(sent.generationConfig.responseSchema.enum.includes("Penal"));
        assert.match(sent.systemInstruction.parts[0].text, /Penal/);
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '"Penal"' }] } }],
          }),
        };
      },
    );
    assert.deepEqual(result, {
      specialty: "Penal",
      classification_status: "classified",
    });
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
