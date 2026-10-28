import nodemailer from "nodemailer";
import { z } from "zod";
export class MailConfigError extends Error {}
export function mailConfig() {
  const mode = process.env.MAIL_MODE || "preview";
  if (!["preview", "gmail"].includes(mode))
    throw new MailConfigError("MAIL_MODE debe ser preview o gmail.");
  let url;
  try {
    url = new URL(process.env.PUBLIC_APP_URL || "http://localhost:5173");
  } catch {
    throw new MailConfigError("PUBLIC_APP_URL no es válida.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || (url.protocol === "http:" && local))
  )
    throw new MailConfigError(
      "PUBLIC_APP_URL debe ser un origen HTTPS sin rutas, credenciales ni parámetros; HTTP solo se admite para localhost.",
    );
  const user = process.env.SMTP_USER || "",
    password = (process.env.SMTP_APP_PASSWORD || "").replace(/\s/g, "");
  const configured =
    z.string().email().safeParse(user).success && password.length > 0;
  const autoValue = process.env.MAIL_AUTO_RESPONSE || "true";
  if (!["true", "false"].includes(autoValue))
    throw new MailConfigError("MAIL_AUTO_RESPONSE debe ser true o false.");
  return {
    mode,
    origin: url.origin,
    local,
    configured,
    user,
    password,
    autoResponse: autoValue === "true",
  };
}
export function gmailTransport(config = mailConfig()) {
  if (!config.configured)
    throw new MailConfigError(
      "Configura SMTP_USER y SMTP_APP_PASSWORD en server/.env y reinicia el servidor. Usa una contraseña de aplicación, no tu contraseña de Gmail.",
    );
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2" },
  });
}
export function mailMessage(kind, token, config = mailConfig()) {
  if (
    !["clarification", "response"].includes(kind) ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    throw new MailConfigError("Notificación inválida.");
  const url = `${config.origin}/#${kind === "clarification" ? "aclaracion" : "respuesta"}=${token}`;
  return {
    subject:
      kind === "clarification"
        ? "Núñez Saldaña · Información adicional para tu consulta"
        : "Núñez Saldaña · Respuesta a tu consulta",
    text: `El equipo de Núñez Saldaña S.A.C. ${kind === "clarification" ? "necesita información adicional para evaluar tu consulta." : "tiene una respuesta aprobada para tu consulta."}\n\nAccede mediante este enlace privado:\n${url}\n\nNo compartas el enlace. ${kind === "clarification" ? "Vence a los 7 días desde la creación de la solicitud y admite una respuesta." : "Vence a los 30 días desde su creación."}${config.local ? "\n\nPRUEBA LOCAL: este enlace solo funciona en la laptop donde se ejecuta LegalTriage AI." : ""}\n\nSi no reconoces esta consulta, contacta al estudio.`,
  };
}
export function safeMailError(error) {
  if (error instanceof MailConfigError) return error.message;
  if (error.code === "EAUTH")
    return "Gmail rechazó la autenticación. Revisa el correo y la contraseña de aplicación; no uses tu contraseña habitual.";
  return "No se pudo confirmar el envío. Revisa el buzón del destinatario antes de repetirlo. Comprueba conexión, configuración de Gmail y registro de notificaciones.";
}
