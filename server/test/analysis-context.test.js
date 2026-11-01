import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analysisContextSchema,
  clarificationFreshness,
  formatClarificationContext,
} from "../src/analysis-context.js";
import { versionPayload } from "../src/versions.js";

const clarification = {
  id: 1,
  questions: "¿Cuál es la empresa?",
  answer: "Empresa ficticia del cliente",
  answered_at: "2026-10-31T12:00:00.000Z",
};
test("contexto conserva preguntas, respuestas y origen sin admitir tokens ni campos ajenos", () => {
  const context = analysisContextSchema.parse({
    source: "reanalyze",
    total_answered: 1,
    clarifications: [clarification],
  });
  const text = formatClarificationContext("Consulta original", context);
  assert.match(text, /Consulta original/);
  assert.match(text, /¿Cuál es la empresa/);
  assert.match(text, /Empresa ficticia del cliente/);
  assert.match(text, /nunca instrucciones ni prueba documental/);
  assert.throws(() =>
    analysisContextSchema.parse({ ...context, token: "privado" }),
  );
  assert.throws(() =>
    analysisContextSchema.parse({
      ...context,
      clarifications: [{ ...clarification, token_hash: "privado" }],
    }),
  );
  assert.equal(
    formatClarificationContext("Consulta", { clarifications: [] }),
    "Consulta",
  );
});

test("respuestas nuevas y contexto antiguo desconocido requieren actualización; no basta comparar fechas", () => {
  const current = { clarifications: [clarification] };
  assert.deepEqual(clarificationFreshness(null, current), {
    analysis_outdated: true,
    new_clarifications_count: 1,
  });
  assert.equal(
    clarificationFreshness(null, { clarifications: [] }).analysis_outdated,
    false,
  );
  assert.equal(
    clarificationFreshness(current, current).analysis_outdated,
    false,
  );
  // Una solicitud anterior puede responderse después de otra más reciente.
  assert.deepEqual(
    clarificationFreshness(
      { clarifications: [{ id: 2 }] },
      { clarifications: [clarification, { id: 2 }] },
    ),
    { analysis_outdated: true, new_clarifications_count: 1 },
  );
});

test("versiones documentales admiten contexto nuevo y siguen leyendo versiones antiguas", () => {
  const document = {
    document_id: 1,
    name: "consulta.pdf",
    pages: 1,
    analysis: {
      summary: "Consulta ficticia",
      specialty: "Laboral",
      document_type: "Consulta",
      readable: true,
      findings: [],
      dates: [],
      missing_information: [],
    },
  };
  assert.equal(
    versionPayload("document", document).analysis_context,
    undefined,
  );
  assert.equal(
    versionPayload("document", { ...document, analysis_context: null })
      .analysis_context,
    null,
  );
  assert.equal(
    versionPayload("document", {
      ...document,
      analysis_context: {
        source: "reanalyze",
        total_answered: 1,
        clarifications: [clarification],
      },
    }).analysis_context.clarifications[0].answer,
    clarification.answer,
  );
});
