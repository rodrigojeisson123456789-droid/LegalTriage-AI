import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTeamPath,
  viewPath,
  teamView,
} from "../../client/src/portal-route.js";
test("accesos separan consulta pública y páginas del equipo", () => {
  assert.equal(viewPath("public"), "/consulta");
  assert.equal(viewPath("login"), "/equipo/login");
  assert.equal(isTeamPath("/consulta"), false);
  assert.equal(isTeamPath("/equipos"), false);
  for (const view of ["dashboard", "team", "account", "deadlines"]) {
    assert.ok(isTeamPath(viewPath(view)));
    assert.equal(teamView(viewPath(view)), view);
  }
});
