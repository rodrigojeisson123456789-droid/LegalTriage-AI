import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { generateContent } from "../src/gemini-client.js";
import { analyzeDocument } from "../src/documents.js";
import { classify } from "../src/domain.js";

const payload = { contents: [{ parts: [{ text: "Texto ficticio" }] }] };
const response = (status, body = {}, retryAfter) => ({
  ok: status === 200,
  status,
  headers: new Headers(retryAfter ? { "Retry-After": retryAfter } : {}),
  json: async () => body,
});
const noWait = { wait: async () => {}, random: () => 0 };

test("503 transitorio: recupera con el mismo modelo, clave, contenido y plazo total", async () => {
  const previous = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  };
  process.env.GEMINI_API_KEY = "clave-ficticia";
  process.env.GEMINI_MODEL = "modelo-ficticio";
  try {
    const sent = [],
      waits = [],
      reports = [];
    const result = await generateContent(payload, {
      random: () => 0,
      wait: async (ms, signal) => waits.push({ ms, signal }),
      onAttempt: (report) => reports.push(report),
      fetcher: async (url, options) => {
        sent.push({ url, ...options });
        return sent.length < 3
          ? response(503, {
              error: {
                code: 503,
                status: "UNAVAILABLE",
                message: "high demand clave-ficticia",
              },
            })
          : response(200, { candidates: [] });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 3);
    assert.deepEqual(
      waits.map((w) => w.ms),
      [1000, 2000],
    );
    for (const request of sent) {
      assert.equal(
        request.url,
        "https://generativelanguage.googleapis.com/v1beta/models/modelo-ficticio:generateContent",
      );
      assert.equal(request.body, JSON.stringify(payload));
      assert.equal(request.headers["x-goog-api-key"], "clave-ficticia");
      assert.equal(request.signal, sent[0].signal);
    }
    assert.ok(waits.every((w) => w.signal === sent[0].signal));
    assert.equal(reports.length, 3);
    assert.equal(reports[2].error, undefined);
    assert.equal(JSON.stringify(reports).includes("clave-ficticia"), false);
    assert.equal(JSON.stringify(reports).includes("Texto ficticio"), false);
  } finally {
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous.model;
  }
});

test("errores HTTP temporales persistentes terminan tras tres intentos", async () => {
  for (const status of [500, 502, 503, 504]) {
    let calls = 0;
    const result = await generateContent(payload, {
      ...noWait,
      fetcher: async () => {
        calls++;
        return response(status);
      },
    });
    assert.equal(calls, 3);
    assert.equal(result.status, status);
    assert.equal(result.ok, false);
  }
});

test("no repite credenciales, permisos, modelo, cuota, solicitudes rechazadas ni errores no seleccionados", async () => {
  for (const status of [400, 401, 403, 404, 413, 422, 429, 501]) {
    let calls = 0;
    const result = await generateContent(payload, {
      ...noWait,
      fetcher: async () => {
        calls++;
        return response(status);
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.status, status);
  }
});

test("respeta Retry-After sin esperar más allá del presupuesto total", async () => {
  const waits = [];
  let calls = 0;
  await generateContent(payload, {
    ...noWait,
    wait: async (ms) => waits.push(ms),
    fetcher: async () =>
      ++calls === 1 ? response(503, {}, "5") : response(200),
  });
  assert.deepEqual(waits, [5000]);
  calls = 0;
  const result = await generateContent(payload, {
    ...noWait,
    wait: async () =>
      assert.fail("No debe esperar ni reiniciar el presupuesto"),
    fetcher: async () => {
      calls++;
      return response(503, {}, "600");
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 503);
});

test("fallos de red y timeouts no duplican una generación incierta", async () => {
  for (const error of [
    new TypeError("fetch failed"),
    new DOMException("timeout", "TimeoutError"),
  ]) {
    let calls = 0;
    await assert.rejects(
      generateContent(payload, {
        ...noWait,
        fetcher: async () => {
          calls++;
          throw error;
        },
      }),
      (received) => received === error,
    );
    assert.equal(calls, 1);
  }
});

test("el plazo también interrumpe la lectura del cuerpo sin reintentar", async () => {
  let calls = 0;
  await assert.rejects(
    generateContent(payload, {
      timeoutMs: 30,
      fetcher: async (_url, { signal }) => {
        calls++;
        return {
          ok: true,
          status: 200,
          json: async () => delay(1000, {}, { signal }),
        };
      },
    }),
    { name: "TimeoutError" },
  );
  assert.equal(calls, 1);
});

test("el plazo también interrumpe la espera sin comenzar otro intento", async () => {
  let calls = 0;
  await assert.rejects(
    generateContent(payload, {
      timeoutMs: 1100,
      random: () => 0,
      wait: (_ms, signal) => delay(2000, undefined, { signal }),
      fetcher: async () => {
        calls++;
        return response(503);
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});

test("clasificación y PDF recuperan 503 y siguen validando el contenido final", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  const analysis = {
    summary: "Consulta ficticia",
    specialty: "Laboral",
    document_type: "Solicitud",
    readable: true,
    findings: [],
    dates: [],
    missing_information: [],
  };
  const document = {
    buffer: Buffer.from("PDF ficticio"),
    mime: "application/pdf",
    pages: 1,
  };
  try {
    for (const [run, output, expected] of [
      [
        (fetcher) => classify("Consulta ficticia", fetcher, noWait),
        "Laboral",
        "classified",
      ],
      [
        (fetcher) =>
          analyzeDocument(document, "Consulta ficticia", fetcher, noWait),
        analysis,
        "analyzed",
      ],
      [
        (fetcher) =>
          analyzeDocument(document, "Consulta ficticia", fetcher, noWait),
        { ...analysis, findings: [{ detail: "Página inválida", page: 2 }] },
        "unavailable",
      ],
    ]) {
      let calls = 0;
      const result = await run(async () =>
        ++calls === 1
          ? response(503)
          : response(200, {
              candidates: [
                { content: { parts: [{ text: JSON.stringify(output) }] } },
              ],
            }),
      );
      assert.equal(calls, 2);
      assert.equal(result.status || result.classification_status, expected);
    }
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
