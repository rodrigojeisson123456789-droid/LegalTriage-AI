import { test } from "node:test";
import assert from "node:assert/strict";
import { mailConfig, mailMessage, safeMailError } from "../src/mail.js";
const keys = ["MAIL_MODE", "SMTP_USER", "SMTP_APP_PASSWORD", "PUBLIC_APP_URL"];
function environment(values, fn) {
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, values);
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
}
test("correo inicia en preview, no expone secretos en el mensaje y valida origen", () =>
  environment({}, () => {
    const config = mailConfig();
    assert.equal(config.mode, "preview");
    assert.equal(config.local, true);
    const token = "a".repeat(64);
    const message = mailMessage("clarification", token, config);
    assert.match(message.text, /#aclaracion=/);
    assert.match(message.text, /PRUEBA LOCAL/);
    assert.throws(() => mailMessage("other", token, config));
    assert.throws(() => mailMessage("response", "token inválido", config));
  }));
test("correo exige HTTPS externo y rechaza rutas/credenciales de origen", () => {
  for (const value of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/ruta",
    "https://example.com?token=x",
  ])
    environment({ PUBLIC_APP_URL: value }, () => assert.throws(mailConfig));
  environment(
    {
      PUBLIC_APP_URL: "https://legal.example.com",
      MAIL_MODE: "gmail",
      SMTP_USER: "test@example.com",
      SMTP_APP_PASSWORD: "abcd efgh ijkl mnop",
    },
    () => {
      const c = mailConfig();
      assert.equal(c.local, false);
      assert.equal(c.configured, true);
      assert.equal(c.password, "abcdefghijklmnop");
      const message = mailMessage("response", "b".repeat(64), c);
      assert.match(message.text, /https:\/\/legal.example.com\/#respuesta=/);
      assert.doesNotMatch(
        message.text,
        /abcdefghijklmnop|test@example.com|PRUEBA LOCAL/,
      );
    },
  );
});
test("errores SMTP muestran diagnósticos conocidos sin revelar respuestas ni credenciales", () => {
  assert.match(
    safeMailError({ code: "EAUTH", message: "secret" }),
    /autenticación/,
  );
  assert.doesNotMatch(
    safeMailError({ message: "secret", response: "private" }),
    /secret|private/,
  );
});
