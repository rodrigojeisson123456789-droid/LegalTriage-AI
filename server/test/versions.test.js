import { test } from "node:test";
import assert from "node:assert/strict";
import { versionPayload } from "../src/versions.js";
import { routeAllowed } from "../src/access.js";
test("versiones validan contenido estructurado y excluyen credenciales y campos ajenos", () => {
  const draft = {
    notes: "Fundamentos internos ficticios",
    reply_type: "Respuesta",
    reply_text: "Respuesta ficticia para revisar",
    amount: "250.50",
    decision: "close",
    revision: 3,
    approved: false,
  };
  assert.equal(versionPayload("evaluation", draft).amount, 250.5);
  assert.throws(() =>
    versionPayload("evaluation", { ...draft, token: "privado" }),
  );
  assert.throws(() =>
    versionPayload("evaluation", { ...draft, amount: "no es importe" }),
  );
  assert.throws(() => versionPayload("evaluation", { ...draft, revision: 0 }));
  assert.throws(() =>
    versionPayload("document", {
      document_id: 1,
      name: "archivo.pdf",
      pages: 1,
      analysis: { summary: "incompleto" },
    }),
  );
  assert.throws(() => versionPayload("otro", {}));
  for (const role of ["gerencia", "abogado", "soporte"])
    assert.equal(routeAllowed(role, "GET", "/cases/1/history/2/version"), true);
  assert.equal(
    routeAllowed("abogado", "PUT", "/cases/1/history/2/version"),
    false,
  );
});
