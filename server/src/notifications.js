import { recordEvent } from "./history.js";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { tokenHash } from "./clarifications.js";
import {
  mailConfig,
  mailMessage,
  gmailTransport,
  safeMailError,
} from "./mail.js";
export const notifications = Router();
notifications.get("/mail/config", (req, res) => {
  const c = mailConfig();
  res.set("Cache-Control", "no-store").json({
    mode: c.mode,
    configured: c.configured,
    local_only: c.local,
    origin: c.origin,
  });
});
notifications.get("/cases/:id/notifications", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [rows] = await db.execute(
    "SELECT kind,status,created_at,updated_at FROM notifications WHERE case_id=? ORDER BY id DESC LIMIT 20",
    [id],
  );
  const [cases] = await db.execute("SELECT email FROM cases WHERE id=?", [id]);
  if (!cases.length)
    return res.status(404).json({ error: "Caso no encontrado" });
  res
    .set("Cache-Control", "no-store")
    .json({ recipient: cases[0].email, events: rows });
});
notifications.post(
  "/cases/:id/notifications",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
  async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id),
      input = z
        .object({
          kind: z.enum(["clarification", "response"]),
          token: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .parse(req.body),
      config = mailConfig(),
      hash = tokenHash(input.token),
      connection = await db.getConnection();
    let recipient, notificationId, transport;
    try {
      await connection.beginTransaction();
      const [cases] = await connection.execute(
        "SELECT email FROM cases WHERE id=? FOR UPDATE",
        [id],
      );
      if (!cases.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Caso no encontrado" });
      }
      recipient = cases[0].email;
      const [links] =
        input.kind === "clarification"
          ? await connection.execute(
              "SELECT id FROM clarifications WHERE case_id=? AND token_hash=? AND answer IS NULL AND cancelled_at IS NULL AND expires_at>UTC_TIMESTAMP()",
              [id, hash],
            )
          : await connection.execute(
              "SELECT l.id FROM response_links l JOIN evaluations e ON e.case_id=l.case_id WHERE l.case_id=? AND l.token_hash=? AND l.revoked_at IS NULL AND l.expires_at>UTC_TIMESTAMP() AND e.approved_at IS NOT NULL",
              [id, hash],
            );
      if (!links.length) {
        await connection.rollback();
        return res.status(409).json({
          error:
            "El enlace no es vigente o no corresponde a este caso. Crea un enlace nuevo.",
        });
      }
      const message = mailMessage(input.kind, input.token, config);
      if (config.mode === "preview") {
        await connection.rollback();
        return res.set("Cache-Control", "no-store").json({
          status: "preview",
          recipient,
          ...message,
          local_only: config.local,
        });
      }
      transport = gmailTransport(config); // Valida configuración antes de registrar un intento.
      const [previous] = await connection.execute(
        "SELECT id,status FROM notifications WHERE kind=? AND token_hash=? FOR UPDATE",
        [input.kind, hash],
      );
      if (previous.length && previous[0].status !== "failed") {
        await connection.rollback();
        return res.status(409).json({
          error:
            "Este enlace ya tiene un envío aceptado, pendiente o sin confirmar. Revisa el registro y el buzón antes de crear otro enlace.",
        });
      }
      if (previous.length) {
        notificationId = previous[0].id;
        await connection.execute(
          "UPDATE notifications SET status='pending',updated_at=UTC_TIMESTAMP() WHERE id=?",
          [notificationId],
        );
      } else {
        const [created] = await connection.execute(
          "INSERT INTO notifications (case_id,kind,token_hash,status,created_by) VALUES (?,?,?,'pending',?)",
          [id, input.kind, hash, req.user.id],
        );
        notificationId = created.insertId;
      }
      await recordEvent(connection, id, "mail.requested", req.user, {
        notification_id: notificationId,
        kind: input.kind,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    try {
      const info = await transport.sendMail({
        from: { name: "Núñez Saldaña S.A.C.", address: config.user },
        to: recipient,
        ...mailMessage(input.kind, input.token, config),
      });
      if (!info.accepted?.length) throw new Error("No recipient accepted");
      await finishNotification(id, notificationId, "accepted", req.user);
      res.json({
        status: "accepted",
        message:
          "Gmail aceptó el correo para envío. Esto no confirma su entrega ni su lectura.",
      });
    } catch (error) {
      const status = error.code === "EAUTH" ? "failed" : "uncertain";
      await finishNotification(id, notificationId, status, req.user);
      res.status(502).json({ error: safeMailError(error), status });
    } finally {
      transport.close();
    }
  },
);

async function finishNotification(caseId, id, status, actor) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
      caseId,
    ]);
    await connection.execute(
      "UPDATE notifications SET status=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
      [status, id],
    );
    await recordEvent(connection, caseId, "mail.result", actor, {
      notification_id: id,
      status,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
