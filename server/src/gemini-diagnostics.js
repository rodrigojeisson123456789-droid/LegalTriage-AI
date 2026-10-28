// Solo para pruebas sintéticas de diagnóstico; nunca imprime el cuerpo completo.
export function providerErrorSummary(body, secrets = []) {
  const error = body?.error;
  if (!error || typeof error !== "object")
    return { message: "La respuesta no contiene un error JSON estructurado." };
  const summary = {};
  if (Number.isInteger(error.code) && error.code >= 100 && error.code <= 599)
    summary.code = error.code;
  if (typeof error.status === "string" && /^[A-Z_]{2,50}$/.test(error.status))
    summary.status = error.status;
  if (typeof error.message === "string") {
    let message = error.message;
    for (const secret of secrets.filter((s) => typeof s === "string" && s)) {
      for (const value of [
        secret,
        encodeURIComponent(secret),
        JSON.stringify(secret).slice(1, -1),
      ])
        message = message.split(value).join("[CLAVE OCULTA]");
    }
    message = message
      .replace(/https?:\/\/[^\s<>"']+/gi, "[URL OCULTA]")
      .replace(/\bAIza[\w-]+/g, "[CLAVE OCULTA]")
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [OCULTO]")
      .replace(
        /((?:api[_-]?key|x-goog-api-key|token|password)\s*[=:]\s*)[^\s,;]+/gi,
        "$1[OCULTO]",
      )
      .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    summary.message =
      message.length > 500 ? message.slice(0, 500) + "…" : message;
  }
  return Object.keys(summary).length
    ? summary
    : { message: "Error sin detalle de texto disponible." };
}
