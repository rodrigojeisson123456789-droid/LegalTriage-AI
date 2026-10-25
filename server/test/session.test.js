import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionRequests } from "../../client/src/session.js";
test("las respuestas tardías de una cuenta no sobrescriben datos ni errores de la siguiente", async () => {
  const sessions = new SessionRequests(),
    old = sessions.start();
  let data = "cuenta anterior",
    error = "";
  let succeed, fail;
  const oldSuccess = new Promise((resolve) => (succeed = resolve)).then(
    (value) => {
      if (old.isCurrent()) data = value;
    },
  );
  const oldFailure = new Promise((resolve, reject) => (fail = reject)).catch(
    (e) => {
      if (old.isCurrent()) error = e.message;
    },
  );
  sessions.invalidate();
  const current = sessions.start();
  if (current.isCurrent()) data = "cuenta nueva";
  succeed("datos antiguos");
  fail(new Error("Inicia sesión para continuar"));
  await Promise.all([oldSuccess, oldFailure]);
  assert.equal(data, "cuenta nueva");
  assert.equal(error, "");
  assert.ok(old.signal.aborted);
  assert.ok(current.isCurrent());
  if (current.isCurrent()) error = "Error vigente de conexión";
  assert.equal(error, "Error vigente de conexión");
  current.finish();
});
