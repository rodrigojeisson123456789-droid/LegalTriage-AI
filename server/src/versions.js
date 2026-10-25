import { z } from "zod";
import { analysisSchema } from "./documents.js";
const evaluation = z
  .object({
    notes: z.string().max(10000),
    reply_type: z.enum(["Respuesta", "Propuesta", "Cotización"]),
    reply_text: z.string().max(10000),
    amount: z.coerce.number().finite().min(0).max(99999999.99).nullable(),
    decision: z.enum(["judicial", "close"]),
    revision: z.number().int().positive(),
    approved: z.boolean(),
  })
  .strict();
const document = z
  .object({
    document_id: z.number().int().positive(),
    name: z.string().max(180),
    pages: z.number().int().positive(),
    analysis: analysisSchema,
  })
  .strict();
export function versionPayload(kind, payload) {
  if (kind === "evaluation") return evaluation.parse(payload);
  if (kind === "document") return document.parse(payload);
  throw new Error("Unknown version kind");
}
export function evaluationPayload(row, approved = !!row.approved_at) {
  return versionPayload("evaluation", {
    notes: row.notes,
    reply_type: row.reply_type,
    reply_text: row.reply_text,
    amount: row.amount,
    decision: row.decision,
    revision: row.revision,
    approved,
  });
}
export async function recordVersion(connection, eventId, kind, payload) {
  const safe = versionPayload(kind, payload);
  await connection.execute(
    "INSERT INTO case_versions (event_id,kind,payload) VALUES (?,?,?)",
    [eventId, kind, JSON.stringify(safe)],
  );
}
