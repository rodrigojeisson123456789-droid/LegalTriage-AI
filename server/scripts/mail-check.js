import "dotenv/config";
import { mailConfig, gmailTransport, safeMailError } from "../src/mail.js";
let transport;
try {
  const config = mailConfig();
  if (config.mode === "preview") {
    console.log(
      "Modo preview: no se envían correos. Configura MAIL_MODE=gmail para verificar Gmail.",
    );
  } else {
    transport = gmailTransport(config);
    await transport.verify();
    console.log(
      "Autenticación y conexión con Gmail correctas. No se envió ningún correo.",
    );
  }
} catch (error) {
  console.error(safeMailError(error));
  process.exitCode = 1;
} finally {
  transport?.close();
}
