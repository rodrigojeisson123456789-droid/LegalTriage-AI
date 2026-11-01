import React from "react";
import { BellRing, ArrowRight } from "lucide-react";

export default function DeadlineReminder({ deadlines, onOpen }) {
  const relevant = deadlines.filter(
    (d) =>
      d.urgency !== "Programado" &&
      d.case_status !== "Atención inicial cerrada",
  );
  if (!relevant.length) return null;
  const expired = relevant.filter((d) => d.urgency === "Vencido").length;
  const critical = relevant.filter((d) => d.urgency === "Crítico").length;
  const soon = relevant.filter((d) => d.urgency === "Próximo").length;
  return (
    <section
      className={`deadline-reminder ${expired ? "has-expired" : ""}`}
      aria-label="Recordatorios de plazos"
    >
      <div className="reminder-title">
        <BellRing size={21} aria-hidden="true" />
        <h2>Plazos que requieren revisión</h2>
      </div>
      <p>
        <strong>{expired} vencido(s)</strong> · {critical} por vencer en 24 h ·{" "}
        {soon} entre 24 y 48 h
      </p>
      <ul>
        {relevant.slice(0, 3).map((d) => (
          <li key={d.id}>
            <span>
              Caso #{d.case_id} · {d.title}
            </span>
            <strong className={`deadline-tone ${d.tone}`}>{d.remaining}</strong>
          </li>
        ))}
      </ul>
      <button type="button" className="text-button" onClick={onOpen}>
        Ver control de plazos <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
