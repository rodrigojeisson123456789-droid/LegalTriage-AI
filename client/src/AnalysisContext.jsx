import React from "react";

export default function AnalysisContext({ context }) {
  if (!context)
    return (
      <p className="help">
        Este análisis anterior no tiene un registro de las aclaraciones
        enviadas. Vuelve a analizar para actualizarlo con las respuestas
        disponibles.
      </p>
    );
  return (
    <div className="analysis-context">
      <h3>Contexto enviado a Gemini</h3>
      <p className="help">
        {context.source === "initial"
          ? "Análisis automático al registrar la consulta: documento y descripción inicial."
          : "Análisis solicitado por el equipo: documento, descripción inicial y respuestas disponibles del cliente."}
      </p>
      {context.clarifications.length === 0 ? (
        <p>
          Este análisis no incluyó aclaraciones: aún no había respuestas del
          cliente.
        </p>
      ) : (
        <>
          <p>
            {context.clarifications.length} aclaración(es) enviada(s) en este
            análisis.
          </p>
          {context.total_answered > context.clarifications.length && (
            <p className="help">
              Se enviaron las últimas {context.clarifications.length} respuestas
              de {context.total_answered} disponibles.
            </p>
          )}
          <details>
            <summary>Ver preguntas y respuestas enviadas</summary>
            {context.clarifications.map((item) => (
              <div className="analysis-clarification" key={item.id}>
                <h4>Aclaración #{item.id}</h4>
                <p className="help">Pregunta del equipo</p>
                <p className="analysis-text">{item.questions}</p>
                <p className="help">Respuesta del cliente</p>
                <p className="analysis-text">{item.answer}</p>
              </div>
            ))}
          </details>
          <p className="help">
            Estas respuestas son declaraciones del cliente. El abogado debe
            contrastar cómo las interpreta Gemini y qué respaldo documental
            sigue pendiente.
          </p>
        </>
      )}
    </div>
  );
}
