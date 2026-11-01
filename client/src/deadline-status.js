export function deadlineStatus(dueAt, now = Date.now()) {
  const ms = new Date(dueAt).getTime() - now;
  if (!Number.isFinite(ms))
    return {
      urgency: "Revisar fecha",
      tone: "expired",
      remaining: "Fecha inválida",
    };
  const urgency =
    ms <= 0
      ? "Vencido"
      : ms <= 86400000
        ? "Crítico"
        : ms <= 172800000
          ? "Próximo"
          : "Programado";
  const minutes = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60;
  const duration = days
    ? `${days} d ${hours} h`
    : hours
      ? `${hours} h ${mins} min`
      : `${mins} min`;
  const remaining =
    minutes === 0
      ? ms <= 0
        ? "Acaba de vencer"
        : "Vence en menos de 1 min"
      : `${ms <= 0 ? "Venció hace" : "Vence en"} ${duration}`;
  return {
    urgency,
    remaining,
    tone:
      ms <= 0
        ? "expired"
        : ms <= 86400000
          ? "critical"
          : ms <= 172800000
            ? "soon"
            : "scheduled",
  };
}
