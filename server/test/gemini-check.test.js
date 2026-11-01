import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
test("gemini:check informa intentos y error filtrado; valida PDF tras recuperar 503", async () => {
  const key = "clave-ficticia-del-diagnostico";
  const mock = `
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Destino inesperado');
      const sent = JSON.parse(options.body);
      if (sent.contents[0].parts[1].inlineData.mimeType !== 'application/pdf') throw new Error('Falta PDF');
      calls++;
      return { ok: calls > 1, status: calls > 1 ? 200 : 503, json: async () => calls === 1
        ? { error: { code: 503, status: 'UNAVAILABLE', message: 'high demand ' + process.env.GEMINI_API_KEY + ' https://example.com/private', details: [{ metadata: { private: 'NO MOSTRAR' } }] } }
        : { candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Contrato ficticio', specialty: 'Civil', document_type: 'Contrato', readable: true, findings: [], dates: [], missing_information: [] }) }] } }] }
      };
    };
  `;
  const { stdout, stderr } = await execute(
    process.execPath,
    [
      "--import",
      "data:text/javascript," + encodeURIComponent(mock),
      "scripts/diagnostics/gemini-check.js",
    ],
    {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        GEMINI_API_KEY: key,
        GEMINI_MODEL: "modelo-ficticio",
      },
      timeout: 10000,
    },
  );
  assert.match(stdout, /Intento 1\/3\. HTTP: 503/);
  assert.match(stdout, /Intento 2\/3\. HTTP: 200/);
  assert.match(stdout, /Conexión y análisis correctos/);
  assert.match(stderr, /high demand/);
  for (const secret of [key, "https://example.com", "NO MOSTRAR", "metadata"])
    assert.equal((stdout + stderr).includes(secret), false);
});
