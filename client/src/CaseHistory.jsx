import React, { useEffect, useRef, useState } from "react";
function description(event) {
  const d = event.details;
  switch (event.action) {
    case "case.created":
      return "Se recibió y guardó la consulta.";
    case "case.classified":
      return d.status === "classified"
        ? `Clasificación sugerida: ${d.specialty}.`
        : "Clasificación no disponible; pendiente de revisión manual.";
    case "case.specialty_changed":
      return `Especialidad revisada: ${d.previous} → ${d.specialty}.`;
    case "case.status_changed":
      return `Estado: ${d.previous} → ${d.status}.`;
    case "assignment.auto":
      return `Asignación automática a ${d.lawyer_name}.`;
    case "assignment.manual":
      return `Responsable asignado manualmente: ${d.lawyer_name}${d.previous_lawyer_id ? ` (anterior: usuario #${d.previous_lawyer_id})` : ""}.`;
    case "document.received":
      return `Documento recibido (${d.mime}, ${d.pages} página(s)).`;
    case "document.analyzed":
      return d.status === "analyzed"
        ? "Análisis documental guardado para revisión."
        : "El análisis documental no pudo completarse; el archivo sigue guardado.";
    case "clarification.requested":
      return `Aclaración #${d.request_id} solicitada. Los enlaces previos pendientes quedan reemplazados.`;
    case "clarification.answered":
      return `Respuesta a la aclaración #${d.request_id} recibida; caso en evaluación.`;
    case "clarification.cancelled":
      return `Solicitud de aclaración #${d.request_id} cancelada.`;
    case "evaluation.saved":
      return `Borrador de evaluación guardado (revisión ${d.revision}).`;
    case "evaluation.approved":
      return `Evaluación aprobada. Decisión: ${d.status}.`;
    case "response.link_created":
      return "Enlace de respuesta aprobada creado; sustituye enlaces anteriores.";
    case "response.links_revoked":
      return "Se revocaron los enlaces de respuesta.";
    case "deadline.created":
      return `Plazo #${d.deadline_id} registrado para ${formatDate(d.due_at)}.`;
    case "mail.requested":
      return `Envío de correo solicitado (${d.kind === "clarification" ? "aclaración" : "respuesta aprobada"}), intento #${d.notification_id}.`;
    case "mail.result":
      return `Correo #${d.notification_id}: ${{ accepted: "aceptado por Gmail; entrega no confirmada", failed: "autenticación rechazada", uncertain: "resultado sin confirmar; revisar buzón antes de repetir" }[d.status]}.`;
    default:
      return "Acción registrada.";
  }
}
const formatDate = (value) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "America/Lima",
  }).format(new Date(value));
export default function CaseHistory({ caseId, api, onClose }) {
  const [events, setEvents] = useState([]),
    [next, setNext] = useState(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    let active = true;
    api(`/cases/${caseId}/history`)
      .then((result) => {
        if (active) {
          setEvents(result.events);
          setNext(result.next_cursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      previous?.focus();
    };
  }, [caseId]);
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const buttons = e.currentTarget.querySelectorAll(
            "button:not(:disabled)",
          );
          const first = buttons[0],
            last = buttons[buttons.length - 1];
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
        aria-labelledby="history-title"
      >
        <div className="title-row">
          <h2 id="history-title">Historial del caso #{caseId}</h2>
          <button ref={close} aria-label="Cerrar historial" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="help">
          Acciones registradas desde la incorporación del historial. Las
          anteriores no se reconstruyen. Fechas en hora de Lima; más recientes
          primero.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!busy && !events.length && !error && (
          <p className="empty">
            Este caso todavía no tiene acciones registradas en el historial.
          </p>
        )}
        <ol className="case-history">
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={event.created_at}>
                {formatDate(event.created_at)}
              </time>
              <p>{description(event)}</p>
              <small>
                {event.actor_name}
                {event.actor_role
                  ? ` · ${{ gerencia: "Gerencia", abogado: "Abogado", soporte: "Soporte" }[event.actor_role]}`
                  : ""}
              </small>
            </li>
          ))}
        </ol>
        {busy && <p role="status">Cargando historial…</p>}
        {next && (
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await api(
                  `/cases/${caseId}/history?before=${next}`,
                );
                setEvents((current) => [...current, ...result.events]);
                setNext(result.next_cursor);
                if (!result.next_cursor)
                  close.current?.focus({ preventScroll: true });
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Ver acciones anteriores
          </button>
        )}
      </section>
    </div>
  );
}
