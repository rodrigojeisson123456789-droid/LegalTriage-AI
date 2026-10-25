import React from "react";
export default function AnalysisContent({ analysis }) {
  return (
    <>
      <div className="document-meta">
        <span className="tag">{analysis.specialty}</span>
        <span>{analysis.document_type}</span>
      </div>
      {!analysis.readable && (
        <div className="error">
          Gemini indica que el documento no es legible. Revisa el original; no
          hay extracción fiable.
        </div>
      )}
      <h3>Resumen</h3>
      <p className="analysis-text">{analysis.summary}</p>
      <h3>Hallazgos y referencias</h3>
      {analysis.findings.length ? (
        <ul>
          {analysis.findings.map((item, i) => (
            <li key={i}>
              {item.detail} <strong>· Pág. {item.page}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="help">No se identificaron hallazgos verificables.</p>
      )}
      <h3>Fechas mencionadas</h3>
      {analysis.dates.length ? (
        <ul>
          {analysis.dates.map((item, i) => (
            <li key={i}>
              <strong>{item.text}</strong> — {item.context}{" "}
              <strong>· Pág. {item.page}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="help">No se detectaron fechas.</p>
      )}
      <div className="notice">
        Estas fechas no son plazos confirmados. El abogado debe verificar la
        notificación y las reglas aplicables antes de registrar una alerta en
        Control de plazos.
      </div>
      <h3>Información faltante o por aclarar</h3>
      {analysis.missing_information.length ? (
        <ul>
          {analysis.missing_information.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="help">
          El análisis no señaló información faltante; esto no garantiza que el
          expediente esté completo.
        </p>
      )}
    </>
  );
}
