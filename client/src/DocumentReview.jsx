import AnalysisContent from "./AnalysisContent.jsx";
import React, { useEffect, useRef, useState } from "react";

const reasons = {
  missing_key: "Falta configurar la clave de Gemini en el servidor.",
  provider_error: "Gemini no estuvo disponible o rechazó la solicitud.",
  analysis_failed:
    "No se obtuvo un resultado válido. El archivo sigue guardado.",
};
export default function DocumentReview({ caseId, api, onClose, onRefresh }) {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const closeButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    let active = true;
    api(`/cases/${caseId}/documents`)
      .then((rows) => {
        if (active) setDocuments(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      previous?.focus();
    };
  }, [caseId]);
  async function retry(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/documents/${id}/analyze`, { method: "POST" });
      setDocuments(await api(`/cases/${caseId}/documents`));
      await onRefresh();
    } catch (e) {
      setError(e.message);
      // Actualiza el diagnóstico guardado sin ocultar el error del reintento.
      try {
        setDocuments(await api(`/cases/${caseId}/documents`));
      } catch {}
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
          const elements = e.currentTarget.querySelectorAll(
            "button:not(:disabled),a[href]",
          );
          const first = elements[0],
            last = elements[elements.length - 1];
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
        aria-labelledby="document-title"
        aria-busy={busy}
      >
        <div className="title-row">
          <h2 id="document-title">Documentos del caso #{caseId}</h2>
          <button
            ref={closeButton}
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar documentos"
          >
            ✕
          </button>
        </div>
        <p className="help">
          Análisis orientativo. Contrasta cada dato con el documento original.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!documents && !error && <p role="status">Cargando documentos…</p>}
        {documents?.length === 0 && (
          <div className="empty">
            Esta consulta no tiene documentos adjuntos.
          </div>
        )}
        {documents?.map((doc) => (
          <article className="document-result" key={doc.id}>
            <div className="document-file">
              <div>
                <h3>{doc.original_name}</h3>
                <span className="help">
                  {doc.mime_type === "application/pdf"
                    ? `${doc.page_count} página(s)`
                    : "Imagen"}
                </span>
              </div>
              <a className="primary" href={`/api/documents/${doc.id}/download`}>
                Descargar original
              </a>
            </div>
            {doc.analysis_status !== "analyzed" && (
              <div className="notice">
                Pendiente de análisis.{" "}
                {doc.failure_message ||
                  reasons[doc.failure_reason] ||
                  "Requiere revisión manual."}
              </div>
            )}
            {doc.analysis && (
              <>
                <AnalysisContent analysis={doc.analysis} />
              </>
            )}
            <button
              className="primary"
              onClick={() => retry(doc.id)}
              disabled={busy}
            >
              {busy
                ? "Analizando documento…"
                : doc.analysis
                  ? "Volver a analizar"
                  : "Analizar con Gemini"}
            </button>
            <p className="help">
              El análisis puede tardar hasta 2 minutos. Las referencias de la IA
              también requieren comprobación.
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
