import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAllowed } from "../src/access.js";
test("roles: Gerencia administra, Soporte tramita y Abogado evalúa sin reasignar", () => {
  for (const route of ["/team", "/users/1/role"])
    assert.equal(routeAllowed("soporte", "PUT", route), false);
  assert.equal(
    routeAllowed("soporte", "POST", "/cases/1/evaluation/approve", {}),
    false,
  );
  assert.equal(routeAllowed("soporte", "GET", "/cases/1/evaluation"), false);
  assert.equal(routeAllowed("soporte", "POST", "/deadlines"), false);
  assert.equal(
    routeAllowed("soporte", "POST", "/cases/1/notifications", {
      kind: "response",
    }),
    false,
  );
  assert.equal(
    routeAllowed("soporte", "POST", "/cases/1/clarifications"),
    true,
  );
  assert.equal(
    routeAllowed("abogado", "POST", "/cases/1/evaluation/approve"),
    true,
  );
  assert.equal(
    routeAllowed("abogado", "PATCH", "/cases/1", { lawyer_id: 2 }),
    false,
  );
  assert.equal(
    routeAllowed("abogado", "PATCH", "/cases/1", { specialty: "Laboral" }),
    true,
  );
  assert.equal(routeAllowed("abogado", "POST", "/cases/1/auto-assign"), false);
  assert.equal(routeAllowed("abogado", "GET", "/team"), false);
  assert.equal(routeAllowed("gerencia", "POST", "/users"), true);
  assert.equal(routeAllowed("inventado", "GET", "/cases"), false);
});
