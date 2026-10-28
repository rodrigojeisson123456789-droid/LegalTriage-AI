import { test } from "node:test";
import assert from "node:assert/strict";
import { providerErrorSummary } from "../src/gemini-diagnostics.js";
test("diagnóstico sintético muestra el detalle 503 sin clave, URLs ni metadatos completos", () => {
  const key = "clave-ficticia-privada-123";
  const body = {
    error: {
      code: 503,
      status: "UNAVAILABLE",
      message: `Model overloaded. key=${key}\nhttps://example.com/?key=${key} Bearer token-secreto`,
      details: [{ metadata: { apiKey: key } }],
    },
  };
  const summary = providerErrorSummary(body, [key]);
  assert.equal(summary.code, 503);
  assert.equal(summary.status, "UNAVAILABLE");
  assert.match(summary.message, /Model overloaded/);
  const output = JSON.stringify(summary);
  for (const secret of [
    key,
    "https://example.com",
    "token-secreto",
    "metadata",
  ])
    assert.equal(output.includes(secret), false);
  assert.doesNotMatch(summary.message, /[\n\r\x1b]/);
  assert.equal(providerErrorSummary(null).code, undefined);
  assert.equal(
    providerErrorSummary({ error: { status: "texto no permitido", code: 900 } })
      .status,
    undefined,
  );
  assert.ok(
    providerErrorSummary({ error: { message: "x".repeat(10000) } }).message
      .length <= 501,
  );
  const encoded = encodeURIComponent("clave+con/espacios");
  assert.equal(
    providerErrorSummary({ error: { message: encoded } }, [
      "clave+con/espacios",
    ]).message.includes(encoded),
    false,
  );
});
