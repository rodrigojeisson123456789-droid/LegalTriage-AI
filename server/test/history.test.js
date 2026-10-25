import { test } from "node:test";
import assert from "node:assert/strict";
import { eventDetails, recordEvent } from "../src/history.js";
import { routeAllowed } from "../src/access.js";
test("historial limita metadatos y rechaza texto privado, secretos y acciones desconocidas", async () => {
  assert.deepEqual(eventDetails("evaluation.saved", { revision: 1 }), {
    revision: 1,
  });
  for (const data of [
    { revision: 1, notes: "privado" },
    { revision: 1, password: "secret" },
    { revision: 1, token: "secret" },
  ])
    assert.throws(() => eventDetails("evaluation.saved", data));
  assert.throws(() => eventDetails("desconocido", {}));
  let writes = 0;
  await assert.rejects(
    recordEvent(
      {
        execute: () => {
          writes++;
        },
      },
      1,
      "mail.result",
      null,
      { notification_id: 1, status: "unknown", token: "private" },
    ),
  );
  assert.equal(writes, 0);
  for (const role of ["gerencia", "soporte", "abogado"])
    assert.equal(routeAllowed(role, "GET", "/cases/1/history"), true);
  assert.equal(routeAllowed("soporte", "DELETE", "/cases/1/history"), false);
});
