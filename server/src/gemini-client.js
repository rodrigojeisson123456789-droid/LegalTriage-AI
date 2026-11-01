import { setTimeout as delay } from "node:timers/promises";
import { GEMINI_REQUEST_TIMEOUT_MS } from "./gemini-settings.js";
import { providerErrorSummary } from "./gemini-diagnostics.js";

const temporaryStatuses = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function retryDelay(response, attempt, random) {
  const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(random() * 250);
  const header = response.headers?.get("retry-after");
  if (!header) return backoff;
  const seconds = /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : NaN;
  const requested = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  return Number.isFinite(requested) ? Math.max(backoff, requested) : backoff;
}

// Solo se repiten rechazos HTTP temporales explícitos. Un timeout o fallo de
// red puede haber ocurrido después de generar contenido: no lo repetimos.
// La misma señal cubre solicitudes, lectura de cuerpos y esperas: 2 min en total.
export async function generateContent(
  payload,
  {
    fetcher = fetch,
    onAttempt,
    timeoutMs = GEMINI_REQUEST_TIMEOUT_MS,
    wait = (ms, signal) => delay(ms, undefined, { signal }),
    random = Math.random,
  } = {},
) {
  const signal = AbortSignal.timeout(timeoutMs);
  const started = Date.now();
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const body = JSON.stringify(payload);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    signal.throwIfAborted();
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal,
        body,
      },
    );
    let data;
    try {
      data = await response.json();
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof SyntaxError)) throw error;
      data = null;
    }
    signal.throwIfAborted();
    const pause =
      !response.ok &&
      temporaryStatuses.has(response.status) &&
      attempt < MAX_ATTEMPTS
        ? retryDelay(response, attempt, random)
        : null;
    const canRetry =
      pause !== null && pause < timeoutMs - (Date.now() - started);
    // El observador es solo para diagnósticos sintéticos; nunca recibe el cuerpo
    // completo, la solicitud, documentos, tokens ni la clave.
    onAttempt?.({
      attempt,
      status: response.status,
      elapsedMs: Date.now() - started,
      ...(response.ok ? {} : { error: providerErrorSummary(data, [key]) }),
      retryInMs: canRetry ? pause : null,
    });
    if (!canRetry)
      return {
        ok: response.ok,
        status: response.status,
        body: data,
        attempts: attempt,
      };
    await wait(pause, signal);
  }
}
