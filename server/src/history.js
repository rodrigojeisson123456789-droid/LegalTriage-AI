import { Router } from "express";
import { z } from "zod";
import { db } from "./db.js";
import { categories } from "./domain.js";
const id = z.number().int().positive();
const state = z.enum([
  "Nuevo",
  "En evaluación",
  "Pendiente de aclaración",
  "En seguimiento judicial",
  "Atención inicial cerrada",
]);
const rules = {
  "case.created": z.object({}).strict(),
  "case.classified": z
    .object({
      specialty: z.enum(categories),
      status: z.enum(["classified", "unavailable"]),
    })
    .strict(),
  "case.specialty_changed": z
    .object({ previous: z.enum(categories), specialty: z.enum(categories) })
    .strict(),
  "case.status_changed": z.object({ previous: state, status: state }).strict(),
  "assignment.auto": z
    .object({ lawyer_id: id, lawyer_name: z.string().max(120) })
    .strict(),
  "assignment.manual": z
    .object({
      previous_lawyer_id: id.nullable(),
      lawyer_id: id,
      lawyer_name: z.string().max(120),
    })
    .strict(),
  "document.received": z
    .object({
      mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
      pages: z.number().int().min(1).max(50),
    })
    .strict(),
  "document.analyzed": z
    .object({ status: z.enum(["analyzed", "unavailable"]) })
    .strict(),
  "clarification.requested": z.object({ request_id: id }).strict(),
  "clarification.answered": z.object({ request_id: id }).strict(),
  "clarification.cancelled": z.object({ request_id: id }).strict(),
  "evaluation.saved": z.object({ revision: id }).strict(),
  "evaluation.approved": z.object({ status: state }).strict(),
  "response.link_created": z.object({}).strict(),
  "response.links_revoked": z.object({}).strict(),
  "deadline.created": z
    .object({ deadline_id: id, due_at: z.string().datetime() })
    .strict(),
  "mail.requested": z
    .object({
      notification_id: id,
      kind: z.enum(["clarification", "response"]),
    })
    .strict(),
  "mail.result": z
    .object({
      notification_id: id,
      status: z.enum(["accepted", "failed", "uncertain"]),
    })
    .strict(),
};
const legalOnly = new Set([
  "evaluation.saved",
  "response.link_created",
  "response.links_revoked",
]);
export function eventDetails(action, details) {
  if (!rules[action]) throw new Error("Unknown history action");
  return rules[action].parse(details);
}
export async function recordEvent(
  connection,
  caseId,
  action,
  actor = null,
  details = {},
) {
  const safe = eventDetails(action, details);
  id.parse(caseId);
  const type =
    actor?.type === "cliente" ? "cliente" : actor?.id ? "usuario" : "sistema";
  let name =
      type === "cliente"
        ? "Cliente mediante formulario o enlace privado"
        : "Sistema",
    userId = null,
    role = null;
  if (type === "usuario") {
    const user = z
      .object({
        id,
        name: z.string().min(1).max(120),
        role: z.enum(["gerencia", "soporte", "abogado"]),
      })
      .parse(actor);
    userId = user.id;
    name = user.name;
    role = user.role;
  }
  await connection.execute(
    "INSERT INTO case_events (case_id,action,actor_type,actor_id,actor_name,actor_role,audience,details) VALUES (?,?,?,?,?,?,?,?)",
    [
      caseId,
      action,
      type,
      userId,
      name,
      role,
      legalOnly.has(action) ? "legal" : "all",
      JSON.stringify(safe),
    ],
  );
}
export const history = Router();
history.get("/cases/:id/history", async (req, res) => {
  const caseId = z.coerce.number().int().positive().parse(req.params.id),
    before = z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .parse(req.query.before);
  const filters = ["case_id=?"],
    params = [caseId];
  if (before) {
    filters.push("id<?");
    params.push(before);
  }
  if (req.user.role === "soporte") filters.push("audience='all'");
  const [rows] = await db.execute(
    "SELECT id,action,actor_type,actor_name,actor_role,details,created_at FROM case_events WHERE " +
      filters.join(" AND ") +
      " ORDER BY id DESC LIMIT 51",
    params,
  );
  const selected = rows
    .slice(0, 50)
    .map((row) => ({
      ...row,
      details: eventDetails(
        row.action,
        typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      ),
    }));
  res
    .set("Cache-Control", "no-store")
    .json({
      events: selected,
      next_cursor: rows.length > 50 ? selected.at(-1).id : null,
    });
});
