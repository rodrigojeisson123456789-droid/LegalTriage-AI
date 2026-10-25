import EmailNotification from "./EmailNotification.jsx";
import React, { useEffect, useState, useRef } from "react";
const date = (v) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(v));
export function ClarificationManager({ caseId, api, onClose, onRefresh }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const [rows, setRows] = useState([]),
    [questions, setQuestions] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    setRows(await api(`/cases/${caseId}/clarifications`));
  }
  useEffect(() => {
    Promise.all([
      api(`/cases/${caseId}/clarifications`),
      api(`/cases/${caseId}/documents`),
    ])
      .then(([history, docs]) => {
        setRows(history);
        setQuestions(
          docs[0]?.analysis?.missing_information
            ?.map((q) => `• ${q}`)
            .join("\n") || "",
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [caseId]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setLink("");
    try {
      const created = await api(`/cases/${caseId}/clarifications`, {
        method: "POST",
        body: JSON.stringify({ questions }),
      });
      setLink(`${window.location.origin}/#aclaracion=${created.token}`);
      await load();
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Tab") {
          const controls = e.currentTarget.querySelectorAll(
            "button:not(:disabled),input,textarea",
          );
          const first = controls[0],
            last = controls[controls.length - 1];
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
        aria-labelledby="clarification-title"
      >
        <div className="title-row">
          <h2 id="clarification-title">Aclaraciones del caso #{caseId}</h2>
          <button
            ref={closeRef}
            aria-label="Cerrar aclaraciones"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="help">
          Revisa y adapta las preguntas sugeridas antes de solicitarlas al
          cliente.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <p>Cargando…</p>
        ) : (
          <>
            <form onSubmit={submit} className="clarification-form">
              <label>
                Información que necesitas del cliente
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={6}
                />
              </label>
              <p className="help">
                Crear una solicitud reemplaza cualquier enlace anterior sin
                responder. El nuevo enlace vence en 7 días y admite una sola
                respuesta.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Guardando…" : "Crear solicitud y enlace privado"}
              </button>
            </form>
            {link && (
              <div className="notice link-notice">
                <div>
                  <strong>
                    Solicitud creada. El enlace no se envía automáticamente.
                  </strong>
                  <label>
                    Enlace privado
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <p>
                    Selecciona y copia el enlace para compartirlo por tu canal
                    habitual. Quien lo tenga puede leer las preguntas y
                    responder; compártelo solo con el cliente.
                  </p>
                  {["localhost", "127.0.0.1", "[::1]"].includes(
                    window.location.hostname,
                  ) && (
                    <p>
                      <strong>
                        Este enlace local funciona solo en tu laptop. Para
                        clientes externos el sistema necesita una dirección
                        pública HTTPS.
                      </strong>
                    </p>
                  )}
                </div>
              </div>
            )}
            {link && (
              <EmailNotification
                caseId={caseId}
                kind="clarification"
                link={link}
                api={api}
              />
            )}
            <h3>Historial · últimas 20 solicitudes</h3>
            {!rows.length && (
              <p className="help">
                Todavía no se ha solicitado información adicional.
              </p>
            )}
            {rows.map((r) => (
              <article className="clarification-history" key={r.id}>
                <span className="tag">
                  {r.answered_at
                    ? "Respondida"
                    : r.cancelled_at
                      ? "Reemplazada o cancelada"
                      : new Date(r.expires_at) <= new Date()
                        ? "Vencida"
                        : "Pendiente"}
                </span>
                <p className="help">
                  Creada: {date(r.created_at)} · Vence: {date(r.expires_at)}
                </p>
                <h3>Preguntas del equipo</h3>
                <p className="analysis-text">{r.questions}</p>
                {r.answer && (
                  <>
                    <h3>Respuesta del cliente · {date(r.answered_at)}</h3>
                    <p className="analysis-text">{r.answer}</p>
                  </>
                )}
                {!r.answered_at && !r.cancelled_at && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await api(`/cases/${caseId}/clarifications/${r.id}`, {
                          method: "DELETE",
                        });
                        setLink("");
                        await load();
                        await onRefresh();
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancelar solicitud e invalidar enlace
                  </button>
                )}
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
export function ClarificationReply({ token, api }) {
  const [request, setRequest] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    api("/clarifications/access", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(setRequest)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="reply-page">
      <section className="card reply-card">
        <div className="eyebrow">NÚÑEZ SALDAÑA S.A.C. · LEGALTRIAGE AI</div>
        <h1>
          Completa tu consulta<span>.</span>
        </h1>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {done ? (
          <div className="success">
            <h2>Recibimos tu aclaración</h2>
            <p>
              Tu respuesta se agregó al mismo caso. El equipo continuará con la
              evaluación.
            </p>
          </div>
        ) : request ? (
          <>
            <p className="help">
              Este enlace es privado. No lo compartas. Vence el{" "}
              {date(request.expires_at)}.
            </p>
            <h3>El equipo necesita la siguiente información:</h3>
            <p className="analysis-text reply-questions">{request.questions}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await api("/clarifications/answer", {
                    method: "POST",
                    body: JSON.stringify({
                      token,
                      answer: data.get("answer"),
                      consent: data.get("consent") === "on",
                    }),
                  });
                  setDone(true);
                  window.history.replaceState(
                    null,
                    "",
                    window.location.pathname + window.location.search,
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Tu respuesta
                <textarea
                  name="answer"
                  required
                  minLength={10}
                  maxLength={10000}
                  rows={8}
                />
              </label>
              <p className="help">
                En esta etapa puedes responder con texto. Para documentos
                adicionales, coordina con el estudio.
              </p>
              <label className="consent">
                <input name="consent" type="checkbox" required />
                <span>
                  Autorizo incorporar esta respuesta a mi consulta y su análisis
                  por el estudio y Gemini. No incluiré contraseñas ni
                  información innecesaria.
                </span>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Guardando respuesta…" : "Enviar aclaración"}
              </button>
            </form>
          </>
        ) : (
          !error && <p role="status">Comprobando enlace privado…</p>
        )}
      </section>
    </div>
  );
}
