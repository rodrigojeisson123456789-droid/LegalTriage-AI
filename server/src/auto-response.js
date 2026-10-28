import { randomBytes } from "node:crypto";
import { tokenHash } from "./clarifications.js";
import { mailConfig, mailMessage, gmailTransport } from "./mail.js";
import { recordEvent } from "./history.js";
import { finishNotification } from "./delivery.js";
export const deliveryNotice = {
  accepted:
    "Gmail aceptó la respuesta aprobada para envío; entrega y lectura no confirmadas.",
  preview: "Modo vista previa: la evaluación fue aprobada sin enviar correo.",
  disabled: "Envío automático desactivado; la evaluación fue aprobada.",
  not_configured:
    "La evaluación fue aprobada, pero falta configurar Gmail. No se envió correo.",
  failed:
    "Gmail rechazó la autenticación. La evaluación sigue aprobada; revisa la configuración antes de reenviar.",
  uncertain:
    "No se pudo confirmar el envío. Revisa el buzón y el registro antes de reenviar.",
  pending:
    "El intento quedó pendiente de confirmar. Revisa el buzón y el registro antes de reenviar.",
};
// Se llama una sola vez dentro de la transacción de aprobación, con el caso bloqueado.
export async function prepareResponse(connection, id, actor, evaluation) {
  let config;
  try {
    config = mailConfig();
  } catch {
    return { status: "not_configured" };
  }
  if (config.mode === "preview") return { status: "preview" };
  if (!config.autoResponse) return { status: "disabled" };
  if (!config.configured) return { status: "not_configured" };
  const token = randomBytes(32).toString("hex"),
    hash = tokenHash(token);
  const [rows] = await connection.execute(
    "SELECT email FROM cases WHERE id=?",
    [id],
  );
  await connection.execute(
    "UPDATE response_links SET revoked_at=UTC_TIMESTAMP() WHERE case_id=? AND revoked_at IS NULL",
    [id],
  );
  await connection.execute(
    "INSERT INTO response_links(case_id,token_hash,expires_at,created_by) VALUES (?,?,?,?)",
    [id, hash, new Date(Date.now() + 30 * 86400000), actor.id],
  );
  await recordEvent(connection, id, "response.link_created", actor);
  const [n] = await connection.execute(
    "INSERT INTO notifications(case_id,kind,token_hash,status,created_by) VALUES (?,'response',?,'pending',?)",
    [id, hash, actor.id],
  );
  await recordEvent(connection, id, "mail.requested", actor, {
    notification_id: n.insertId,
    kind: "response",
  });
  const message = mailMessage("response", token, config);
  const amount =
    evaluation.amount === null
      ? ""
      : `\nImporte propuesto: ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(evaluation.amount))}\n`;
  return {
    status: "pending",
    id,
    notificationId: n.insertId,
    actor,
    recipient: rows[0].email,
    config,
    message: {
      ...message,
      text: `${evaluation.reply_type}\n\n${evaluation.reply_text}\n${amount}\n${message.text}`,
    },
  };
}
export async function deliverResponse(job) {
  if (!job.notificationId)
    return { status: job.status, message: deliveryNotice[job.status] };
  let transport,
    status = "uncertain";
  try {
    transport = gmailTransport(job.config);
    const info = await transport.sendMail({
      from: { name: "Núñez Saldaña S.A.C.", address: job.config.user },
      to: job.recipient,
      ...job.message,
    });
    if (!info.accepted?.length) throw new Error("No recipient accepted");
    status = "accepted";
  } catch (error) {
    status = error.code === "EAUTH" ? "failed" : "uncertain";
  } finally {
    transport?.close();
  }
  try {
    await finishNotification(job.id, job.notificationId, status, job.actor);
  } catch {
    status = "pending";
    console.error("Automatic mail: persistence_pending");
  }
  return { status, message: deliveryNotice[status] };
}
