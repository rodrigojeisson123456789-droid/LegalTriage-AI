import React, { useState, useEffect, useRef } from "react";
import AnalysisContent from "./AnalysisContent.jsx";
export default function VersionReader({ caseId, eventId, api }) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/cases/${caseId}/history/${eventId}/version`);
      if (alive.current) setData(result);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const payload = data?.payload;
  return (
    <div className="history-version">
      <button
        className="text-button"
        aria-expanded={open}
        aria-controls={`version-${eventId}`}
        onClick={toggle}
      >
        {open ? "Ocultar versión" : "Ver versión guardada"}
      </button>
      {open && (
        <section
          id={`version-${eventId}`}
          aria-label={`Contenido guardado de la acción ${eventId}`}
          className="version-content"
        >
          <p className="notice">
            Versión guardada · Solo lectura. Consultarla no cambia el contenido
            actual del caso.
          </p>
          {busy && <p role="status">Cargando versión…</p>}
          {error && (
            <p role="alert" className="error">
              {error} Cierra esta versión y vuelve a abrirla para reintentar.
            </p>
          )}
          {payload && data.kind === "evaluation" && (
            <>
              <h3>
                Evaluación · Revisión {payload.revision} ·{" "}
                {payload.approved ? "Aprobada" : "Borrador"}
              </h3>
              <h4>Fundamentos internos</h4>
              <p className="analysis-text">{payload.notes}</p>
              <h4>{payload.reply_type} para el cliente</h4>
              <p className="analysis-text">{payload.reply_text}</p>
              {payload.amount !== null && (
                <p>
                  Importe:{" "}
                  {new Intl.NumberFormat("es-PE", {
                    style: "currency",
                    currency: "PEN",
                  }).format(Number(payload.amount))}
                </p>
              )}
              <p>
                Decisión:{" "}
                {payload.decision === "judicial"
                  ? "Seguimiento judicial"
                  : "Cerrar atención inicial"}
                .
              </p>
            </>
          )}
          {payload && data.kind === "document" && (
            <>
              <h3>Análisis de Gemini · {payload.name}</h3>
              <p className="help">
                {payload.pages} página(s). Análisis orientativo sujeto a
                revisión del abogado.
              </p>
              <AnalysisContent analysis={payload.analysis} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
