import EmailNotification from "./EmailNotification.jsx";
import React, { useEffect, useRef, useState } from "react";
const dates = (value) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
const money = (value) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(value),
  );
const empty = {
  notes: "",
  reply_type: "Respuesta",
  reply_text: "",
  amount: "",
  decision: "",
};
export default function Evaluation({
  caseId,
  api,
  onClose,
  onRefresh,
  onDeadlines,
}) {
  const [data, setData] = useState(null),
    [form, setForm] = useState(empty),
    [saved, setSaved] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [link, setLink] = useState("");
  const closeRef = useRef(null);
  const dirty =
    saved !== null && JSON.stringify(form) !== JSON.stringify(saved);
  async function load() {
    const value = await api(`/cases/${caseId}/evaluation`);
    setData(value);
    const record = value.evaluation;
    const fields = record
      ? {
          notes: record.notes,
          reply_type: record.reply_type,
          reply_text: record.reply_text,
          amount: record.amount ?? "",
          decision: record.decision,
        }
      : empty;
    setForm(fields);
    setSaved(fields);
    setConfirmed(false);
  }
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    load().catch((e) => setError(e.message));
    return () => previous?.focus();
  }, [caseId]);
  async function act(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const approved = !!data?.evaluation?.approved_at;
  function update(key, value) {
    setConfirmed(false);
    setForm({ ...form, [key]: value });
  }
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy && !dirty) onClose();
        if (e.key === "Tab") {
          const all = e.currentTarget.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
          );
          const first = all[0],
            last = all[all.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        className="card document-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluation-title"
      >
        <div className="title-row">
          <h2 id="evaluation-title">Evaluación del caso #{caseId}</h2>
          <button
            ref={closeRef}
            aria-label="Cerrar evaluación"
            disabled={busy}
            onClick={() =>
              dirty
                ? setError(
                    "Hay cambios sin guardar. Guarda el borrador o usa «Descartar cambios y cerrar».",
                  )
                : onClose()
            }
          >
            ✕
          </button>
        </div>
        <p className="help">
          El abogado redacta y aprueba la decisión. Las notas internas no se
          comparten con el cliente.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {!data && !error && <p>Cargando evaluación…</p>}
        {data && (
          <>
            <div className="evaluation-meta">
              <span className="tag">{approved ? "Aprobada" : "Borrador"}</span>
              <span>{data.case_status}</span>
              {dirty && <strong>Cambios sin guardar</strong>}
            </div>
            {data.pending_clarifications > 0 && (
              <div className="notice">
                Hay aclaraciones pendientes. Puedes preparar un borrador; para
                aprobarlo, revisa la respuesta o cancela la solicitud.
              </div>
            )}
            <form
              className="evaluation-form"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  await api(`/cases/${caseId}/evaluation`, {
                    method: "PUT",
                    body: JSON.stringify({
                      ...form,
                      amount: form.amount === "" ? null : Number(form.amount),
                      expected_revision: data.evaluation?.revision || 0,
                    }),
                  });
                  await load();
                  await onRefresh();
                  setNotice(
                    "Borrador guardado. Todavía no está aprobado ni enviado al cliente.",
                  );
                });
              }}
            >
              <label>
                Conclusiones internas del abogado
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  required
                  minLength={20}
                  maxLength={10000}
                  rows={5}
                  disabled={approved || busy}
                  placeholder="Documentos revisados, hechos confirmados, riesgos y fundamentos de la evaluación…"
                />
              </label>
              <div className="fields">
                <label>
                  Tipo de comunicación
                  <select
                    value={form.reply_type}
                    onChange={(e) => update("reply_type", e.target.value)}
                    disabled={approved || busy}
                  >
                    {["Respuesta", "Propuesta", "Cotización"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Importe propuesto (S/)
                  {form.reply_type !== "Cotización" && " · opcional"}
                  <input
                    type="number"
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    required={form.reply_type === "Cotización"}
                    disabled={approved || busy}
                  />
                </label>
              </div>
              <label>
                Respuesta o propuesta para el cliente
                <textarea
                  name="reply_text"
                  value={form.reply_text}
                  onChange={(e) => update("reply_text", e.target.value)}
                  required
                  minLength={20}
                  maxLength={10000}
                  rows={7}
                  disabled={approved || busy}
                  placeholder="Redacta aquí el texto que sí podrá leer el cliente. Incluye alcance, condiciones y siguientes pasos."
                />
              </label>
              <label>
                Decisión sobre la atención
                <select
                  required
                  value={form.decision}
                  onChange={(e) => update("decision", e.target.value)}
                  disabled={approved || busy}
                >
                  <option value="" disabled>
                    Selecciona una decisión
                  </option>
                  <option value="judicial">
                    Continuar con seguimiento judicial
                  </option>
                  <option value="close">Cerrar la atención inicial</option>
                </select>
              </label>
              <p className="help">
                Cerrar la atención inicial no es declarar concluido un proceso
                judicial. No se permite cerrar si hay plazos futuros
                registrados.
              </p>
              {!approved && (
                <div className="form-footer">
                  <button className="primary" disabled={busy}>
                    Guardar borrador
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!dirty) act(load);
                      else
                        setError(
                          "Recargar descartaría tus cambios. Primero guárdalos o cierra descartándolos.",
                        );
                    }}
                  >
                    Recargar evaluación
                  </button>
                </div>
              )}
            </form>
            <section className="evaluation-preview">
              <h3>Vista previa para el cliente</h3>
              <strong>{form.reply_type}</strong>
              <p className="analysis-text">
                {form.reply_text || "La respuesta aparecerá aquí."}
              </p>
              {form.amount !== "" && (
                <p>
                  <strong>Importe propuesto: {money(form.amount)}</strong>
                </p>
              )}
              <p className="help">
                Esta vista previa excluye las conclusiones internas.
              </p>
            </section>
            {approved && data.response_notification && (
              <p className="notice" role="status">
                Última notificación de respuesta:{" "}
                {
                  {
                    accepted: "aceptada por Gmail (entrega no confirmada)",
                    failed: "autenticación rechazada",
                    uncertain:
                      "resultado incierto; revisar buzón antes de reenviar",
                    pending:
                      "pendiente de confirmar; revisar registro antes de reenviar",
                  }[data.response_notification.status]
                }
                .
              </p>
            )}
            {approved ? (
              <>
                <p className="help">
                  Crear otro enlace sustituye al anterior, incluido el enviado
                  automáticamente. Revisa el último envío antes de compartir uno
                  nuevo.
                </p>

                <div className="notice">
                  Aprobada por {data.evaluation.approved_by_name} el{" "}
                  {dates(data.evaluation.approved_at)}. La evaluación queda
                  bloqueada para conservar la decisión.
                </div>
                {data.case_status === "En seguimiento judicial" && (
                  <button className="primary" onClick={onDeadlines}>
                    Ir a Control de plazos
                  </button>
                )}
                <div className="form-footer">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const result = await api(
                          `/cases/${caseId}/evaluation/share`,
                          { method: "POST" },
                        );
                        setLink(
                          `${window.location.origin}/#respuesta=${result.token}`,
                        );
                        setNotice(
                          "Enlace creado. Usa la sección de notificaciones para preparar o enviar el correo.",
                        );
                      })
                    }
                  >
                    Crear enlace de respuesta aprobada
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api(`/cases/${caseId}/evaluation/share`, {
                          method: "DELETE",
                        });
                        setLink("");
                        setNotice(
                          "Los enlaces de respuesta anteriores quedaron revocados.",
                        );
                      })
                    }
                  >
                    Revocar enlaces
                  </button>
                </div>
                {link && (
                  <div className="notice link-notice">
                    <div>
                      <label>
                        Enlace de respuesta para el cliente
                        <input
                          readOnly
                          value={link}
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                      <p>
                        Copia y comparte este enlace por tu canal habitual.
                        Vence en 30 días; crear otro invalida el anterior. Quien
                        lo tenga podrá leer la respuesta aprobada.
                      </p>
                      {["localhost", "127.0.0.1", "[::1]"].includes(
                        window.location.hostname,
                      ) && (
                        <p>
                          Esta dirección local solo funciona en tu laptop. Para
                          clientes externos necesitas una dirección pública
                          HTTPS.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {link && (
                  <EmailNotification
                    caseId={caseId}
                    kind="response"
                    link={link}
                    api={api}
                  />
                )}
              </>
            ) : (
              <div className="evaluation-approval">
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    disabled={busy || dirty || !data.evaluation}
                  />
                  <span>
                    He revisado los documentos, las aclaraciones y la respuesta.
                    Confirmo la decisión; al aprobar, la evaluación quedará
                    bloqueada. Si el envío automático por Gmail está habilitado,
                    se enviará automáticamente la respuesta aprobada al correo
                    del caso.
                  </span>
                </label>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    dirty ||
                    !data.evaluation ||
                    !confirmed ||
                    data.pending_clarifications > 0
                  }
                  onClick={() =>
                    act(async () => {
                      const result = await api(
                        `/cases/${caseId}/evaluation/approve`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            expected_revision: data.evaluation.revision,
                            confirmed,
                          }),
                        },
                      );
                      await load();
                      await onRefresh();
                      setNotice(
                        result.notification?.message || "Evaluación aprobada.",
                      );
                    })
                  }
                >
                  Aprobar evaluación y decisión
                </button>
              </div>
            )}
            {dirty && (
              <button className="text-button" disabled={busy} onClick={onClose}>
                Descartar cambios y cerrar
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
export function ClientResponse({ token, api }) {
  const [response, setResponse] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/responses/access", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(setResponse)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="reply-page">
      <section className="card reply-card">
        <div className="eyebrow">NÚÑEZ SALDAÑA S.A.C. · LEGALTRIAGE AI</div>
        <h1>
          Respuesta del estudio<span>.</span>
        </h1>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!response && !error && <p>Cargando respuesta privada…</p>}
        {response && (
          <>
            <span className="tag">{response.reply_type}</span>
            <p className="help">
              Aprobada por el equipo el {dates(response.approved_at)}.
            </p>
            <p className="analysis-text reply-questions">
              {response.reply_text}
            </p>
            {response.amount !== null && (
              <p>
                <strong>Importe propuesto: {money(response.amount)}</strong>
              </p>
            )}
            <p className="help">
              Una propuesta o cotización no acredita contratación ni pago.
              Contacta al estudio para coordinar los siguientes pasos. Este
              enlace es privado; no lo compartas.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
