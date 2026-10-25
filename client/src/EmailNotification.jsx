import React, { useEffect, useState } from "react";
const statuses = {
  pending: "Envío en curso o pendiente de confirmar",
  accepted: "Aceptado por Gmail (entrega no confirmada)",
  failed: "Autenticación rechazada",
  uncertain: "Resultado incierto: revisar buzón antes de repetir",
};
export default function EmailNotification({ caseId, kind, link, api }) {
  const [config, setConfig] = useState(null),
    [history, setHistory] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  async function load() {
    const [c, h] = await Promise.all([
      api("/mail/config"),
      api(`/cases/${caseId}/notifications`),
    ]);
    setConfig(c);
    setHistory(h);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [caseId]);
  useEffect(() => {
    setPreview(null);
    setMessage("");
    setConfirmed(false);
    setError("");
  }, [link]);
  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = new URL(link).hash.split("=")[1];
      const result = await api(`/cases/${caseId}/notifications`, {
        method: "POST",
        body: JSON.stringify({ kind, token }),
      });
      if (result.status === "preview") setPreview(result);
      else {
        setPreview(null);
        setMessage(result.message);
      }
      await load();
    } catch (e) {
      setError(e.message);
      try {
        await load();
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="email-notification">
      <h3>Notificación por Gmail</h3>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {!config && !error && <p>Cargando configuración…</p>}
      {config && (
        <>
          <p>
            Destinatario: <strong>{history?.recipient || "Cargando…"}</strong>
          </p>
          <p className="help">
            El destinatario se toma del caso. El correo incluye un aviso y el
            enlace privado, sin notas internas ni documentos adjuntos.
          </p>
          {config.local_only && (
            <p className="help">
              <strong>Prueba local:</strong> el enlace del correo solo abrirá el
              sistema en la laptop donde está instalado. Para clientes externos
              configura PUBLIC_APP_URL con tu dirección pública HTTPS.
            </p>
          )}
          {config.mode === "preview" ? (
            <>
              <p className="help">
                Modo vista previa: no se enviará ningún correo.
              </p>
              <button
                className="primary"
                disabled={busy || !history}
                onClick={submit}
              >
                {busy ? "Preparando…" : "Ver correo de prueba (sin enviar)"}
              </button>
            </>
          ) : (
            <>
              {!config.configured && (
                <p className="help">
                  Configura SMTP_USER y SMTP_APP_PASSWORD en server/.env y
                  reinicia. No uses tu contraseña habitual.
                </p>
              )}
              <label className="consent">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy || !config.configured}
                />
                <span>
                  Confirmo enviar esta notificación al correo del caso.
                </span>
              </label>
              <button
                className="primary"
                disabled={busy || !confirmed || !config.configured || !history}
                onClick={submit}
              >
                {busy ? "Enviando a Gmail…" : "Enviar notificación por Gmail"}
              </button>
            </>
          )}
          {preview && (
            <div className="email-preview">
              <strong>{preview.subject}</strong>
              <p>Para: {preview.recipient}</p>
              <pre>{preview.text}</pre>
            </div>
          )}
          {history?.events.filter((e) => e.kind === kind).length > 0 && (
            <details>
              <summary>Últimos intentos de notificación</summary>
              <ul>
                {history.events
                  .filter((e) => e.kind === kind)
                  .map((event, i) => (
                    <li key={i}>
                      {new Date(event.created_at).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                      })}{" "}
                      · {statuses[event.status]}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
