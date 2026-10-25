import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluationSchema } from "../src/evaluations.js";
const valid = {
  expected_revision: 0,
  notes: "Hechos y documentos revisados por el abogado.",
  reply_type: "Respuesta",
  reply_text: "Proponemos coordinar la revisión de los documentos originales.",
  amount: null,
  decision: "judicial",
};
test("evaluación exige fundamentos, respuesta, decisión e importe válido para cotización", () => {
  assert.ok(evaluationSchema.safeParse(valid).success);
  assert.ok(
    evaluationSchema.safeParse({
      ...valid,
      reply_type: "Cotización",
      amount: 250.5,
    }).success,
  );
  for (const change of [
    { notes: "corto" },
    { reply_text: "corto" },
    { reply_type: "Cotización" },
    { amount: -1 },
    { amount: 0.001 },
    { decision: "inventada" },
    { expected_revision: -1 },
  ])
    assert.equal(
      evaluationSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
