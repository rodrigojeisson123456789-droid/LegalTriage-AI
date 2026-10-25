import { guardCaseWrite } from "./access.js";
import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import { tokenHash } from "./clarifications.js";
export const finalizedStates = [
  "En seguimiento judicial",
  "Atención inicial cerrada",
];
export const evaluationSchema = z
  .object({
    expected_revision: z.number().int().nonnegative(),
    notes: z.string().trim().min(20).max(10000),
    reply_type: z.enum(["Respuesta", "Propuesta", "Cotización"]),
    reply_text: z.string().trim().min(20).max(10000),
    amount: z
      .number()
      .finite()
      .min(0)
      .max(99999999.99)
      .multipleOf(0.01)
      .nullable(),
    decision: z.enum(["judicial", "close"]),
  })
  .refine((v) => v.reply_type !== "Cotización" || v.amount !== null, {
    message: "La cotización requiere un importe en soles.",
  });
export const evaluations = Router();
const idOf = (req) => z.coerce.number().int().positive().parse(req.params.id);
evaluations.get("/:id/evaluation", async (req, res) => {
  const id = idOf(req);
  const [cases] = await db.execute("SELECT id,status FROM cases WHERE id=?", [
    id,
  ]);
  if (!cases.length)
    return res.status(404).json({ error: "Caso no encontrado" });
  const [rows] = await db.execute(
    "SELECT e.*,u.name AS approved_by_name FROM evaluations e LEFT JOIN users u ON u.id=e.approved_by WHERE e.case_id=?",
    [id],
  );
  const [pending] = await db.execute(
    "SELECT COUNT(*) AS n FROM clarifications WHERE case_id=? AND answer IS NULL AND cancelled_at IS NULL AND expires_at>UTC_TIMESTAMP()",
    [id],
  );
  const [deadlines] = await db.execute(
    "SELECT COUNT(*) AS n FROM deadlines WHERE case_id=? AND due_at>UTC_TIMESTAMP()",
    [id],
  );
  res.set("Cache-Control", "no-store").json({
    case_status: cases[0].status,
    evaluation: rows[0] || null,
    pending_clarifications: pending[0].n,
    future_deadlines: deadlines[0].n,
  });
});
evaluations.put("/:id/evaluation", async (req, res) => {
  const id = idOf(req),
    input = evaluationSchema.parse(req.body),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (req.user) {
      await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
        id,
      ]);
      await guardCaseWrite(req, connection, id);
    }
    const [cases] = await connection.execute(
      "SELECT status FROM cases WHERE id=? FOR UPDATE",
      [id],
    );
    if (!cases.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Caso no encontrado" });
    }
    const [rows] = await connection.execute(
      "SELECT revision,approved_at FROM evaluations WHERE case_id=? FOR UPDATE",
      [id],
    );
    if (finalizedStates.includes(cases[0].status) || rows[0]?.approved_at) {
      await connection.rollback();
      return res.status(409).json({
        error: "La evaluación ya fue aprobada y no puede modificarse.",
      });
    }
    if ((rows[0]?.revision || 0) !== input.expected_revision) {
      await connection.rollback();
      return res.status(409).json({
        error:
          "Otro usuario guardó cambios. Recarga la evaluación antes de editar.",
      });
    }
    const revision = input.expected_revision + 1;
    await connection.execute(
      `INSERT INTO evaluations (case_id,notes,reply_type,reply_text,amount,decision,revision,updated_by) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE notes=VALUES(notes),reply_type=VALUES(reply_type),reply_text=VALUES(reply_text),amount=VALUES(amount),decision=VALUES(decision),revision=VALUES(revision),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()`,
      [
        id,
        input.notes,
        input.reply_type,
        input.reply_text,
        input.amount,
        input.decision,
        revision,
        req.user.id,
      ],
    );
    // Guardar un borrador no resuelve una aclaración todavía pendiente.
    await connection.execute(
      "UPDATE cases SET status='En evaluación' WHERE id=? AND status='Nuevo'",
      [id],
    );
    await connection.commit();
    res.json({ revision });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
evaluations.post("/:id/evaluation/approve", async (req, res) => {
  const id = idOf(req);
  const input = z
    .object({
      expected_revision: z.number().int().positive(),
      confirmed: z.literal(true),
    })
    .parse(req.body);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (req.user) {
      await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
        id,
      ]);
      await guardCaseWrite(req, connection, id);
    }
    const [cases] = await connection.execute(
      "SELECT status FROM cases WHERE id=? FOR UPDATE",
      [id],
    );
    if (!cases.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Caso no encontrado" });
    }
    const [rows] = await connection.execute(
      "SELECT * FROM evaluations WHERE case_id=? FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (
      !row ||
      row.approved_at ||
      finalizedStates.includes(cases[0].status) ||
      row.revision !== input.expected_revision
    ) {
      await connection.rollback();
      return res.status(409).json({
        error:
          "No existe un borrador vigente para aprobar. Recarga la evaluación.",
      });
    }
    const [pending] = await connection.execute(
      "SELECT COUNT(*) AS n FROM clarifications WHERE case_id=? AND answer IS NULL AND cancelled_at IS NULL AND expires_at>UTC_TIMESTAMP()",
      [id],
    );
    if (pending[0].n) {
      await connection.rollback();
      return res.status(409).json({
        error:
          "Hay una aclaración pendiente. Revisa la respuesta o cancela la solicitud antes de aprobar.",
      });
    }
    const [deadlines] = await connection.execute(
      "SELECT COUNT(*) AS n FROM deadlines WHERE case_id=? AND due_at>UTC_TIMESTAMP()",
      [id],
    );
    if (row.decision === "close" && deadlines[0].n) {
      await connection.rollback();
      return res.status(409).json({
        error:
          "Hay plazos futuros registrados. Mantén el seguimiento judicial; no se puede cerrar la atención con esos plazos pendientes.",
      });
    }
    const status =
      row.decision === "judicial"
        ? "En seguimiento judicial"
        : "Atención inicial cerrada";
    await connection.execute(
      "UPDATE evaluations SET approved_by=?,approved_at=UTC_TIMESTAMP(),revision=revision+1 WHERE case_id=?",
      [req.user.id, id],
    );
    await connection.execute("UPDATE cases SET status=? WHERE id=?", [
      status,
      id,
    ]);
    await connection.execute(
      "UPDATE clarifications SET cancelled_at=UTC_TIMESTAMP() WHERE case_id=? AND answer IS NULL AND cancelled_at IS NULL",
      [id],
    );
    await connection.commit();
    res.json({ status });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
evaluations.post("/:id/evaluation/share", async (req, res) => {
  const id = idOf(req),
    token = randomBytes(32).toString("hex"),
    expires = new Date(Date.now() + 30 * 24 * 3600000),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (req.user) {
      await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
        id,
      ]);
      await guardCaseWrite(req, connection, id);
    }
    await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
      id,
    ]);
    const [rows] = await connection.execute(
      "SELECT approved_at FROM evaluations WHERE case_id=?",
      [id],
    );
    if (!rows[0]?.approved_at) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: "Aprueba primero la evaluación y la respuesta." });
    }
    await connection.execute(
      "UPDATE response_links SET revoked_at=UTC_TIMESTAMP() WHERE case_id=? AND revoked_at IS NULL",
      [id],
    );
    await connection.execute(
      "INSERT INTO response_links (case_id,token_hash,expires_at,created_by) VALUES (?,?,?,?)",
      [id, tokenHash(token), expires, req.user.id],
    );
    await connection.commit();
    res
      .set("Cache-Control", "no-store")
      .status(201)
      .json({ token, expires_at: expires });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
evaluations.delete("/:id/evaluation/share", async (req, res) => {
  const id = idOf(req),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (req.user) {
      await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
        id,
      ]);
      await guardCaseWrite(req, connection, id);
    }
    await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
      id,
    ]);
    await connection.execute(
      "UPDATE response_links SET revoked_at=UTC_TIMESTAMP() WHERE case_id=? AND revoked_at IS NULL",
      [id],
    );
    await connection.commit();
    res.sendStatus(204);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
export const publicResponses = Router();
publicResponses.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
publicResponses.post("/access", async (req, res) => {
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(req.body);
  const [rows] = await db.execute(
    "SELECT e.reply_type,e.reply_text,e.amount,e.approved_at FROM response_links l JOIN evaluations e ON e.case_id=l.case_id WHERE l.token_hash=? AND l.revoked_at IS NULL AND l.expires_at>UTC_TIMESTAMP() AND e.approved_at IS NOT NULL",
    [tokenHash(token)],
  );
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  if (!rows.length)
    return res.status(404).json({
      error:
        "El enlace no está disponible. Solicita al estudio un enlace vigente.",
    });
  res.json({ ...rows[0], currency: "PEN" }); // Nunca notas internas, DNI o expediente.
});
