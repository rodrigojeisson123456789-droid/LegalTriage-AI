import { db } from "./db.js";
import { gmailTransport, mailConfig } from "./mail.js";
import { recordEvent } from "./history.js";

export function reminderStage(dueAt, now = Date.now()) {
  const remaining = new Date(dueAt).getTime() - now;
  return !Number.isFinite(remaining) || remaining > 172800000
    ? null
    : remaining <= 0
      ? "expired"
      : remaining <= 86400000
        ? "24h"
        : "48h";
}
export function deadlineMessage(job, config) {
  const stageText = {
    "48h": "Vence en las próximas 48 horas",
    "24h": "Vence en las próximas 24 horas",
    expired: "Plazo vencido",
  }[job.stage];
  const due = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(job.due_at));
  return {
    subject: `LegalTriage · ${stageText} · Caso #${job.case_id}`,
    text: `${stageText}\n\nCaso #${job.case_id}\nActuación: ${job.title}\nFecha límite: ${due} (hora de Lima).\n\nRevisa el plazo registrado y la actuación correspondiente en el panel del equipo:\n${config.origin}/equipo/plazos\n${config.local ? "\nPRUEBA LOCAL: el enlace solo funciona en la computadora donde se ejecuta LegalTriage AI.\n" : ""}\nAviso dirigido al responsable del caso. No es una comunicación al cliente.`,
  };
}

async function claim(database, deadlineId, now) {
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [found] = await connection.execute(
      "SELECT case_id FROM deadlines WHERE id=?",
      [deadlineId],
    );
    if (!found.length) {
      await connection.rollback();
      return null;
    }
    const [cases] = await connection.execute(
      "SELECT c.id,c.status,c.lawyer_id,u.email,u.role FROM cases c LEFT JOIN users u ON u.id=c.lawyer_id WHERE c.id=? FOR UPDATE",
      [found[0].case_id],
    );
    const record = cases[0];
    const [rows] = await connection.execute(
      "SELECT id,case_id,title,due_at FROM deadlines WHERE id=?",
      [deadlineId],
    );
    const deadline = rows[0];
    const stage = deadline ? reminderStage(deadline.due_at, now) : null;
    if (
      !stage ||
      record?.status === "Atención inicial cerrada" ||
      !["gerencia", "abogado"].includes(record?.role)
    ) {
      await connection.rollback();
      return null;
    }
    // La unicidad persiste entre procesos/reinicios. Solo se reserva la etapa
    // vigente: al encender después del vencimiento no se envían también 48h/24h.
    const [inserted] = await connection.execute(
      "INSERT IGNORE INTO deadline_reminders(deadline_id,recipient_id,recipient_email,stage,status) VALUES (?,?,?,?,'pending')",
      [deadline.id, record.lawyer_id, record.email, stage],
    );
    if (!inserted.affectedRows) {
      await connection.rollback();
      return null;
    }
    await recordEvent(
      connection,
      deadline.case_id,
      "deadline.reminder_requested",
      null,
      { deadline_id: deadline.id, reminder_id: inserted.insertId, stage },
    );
    await connection.commit();
    return {
      ...deadline,
      stage,
      reminderId: inserted.insertId,
      recipient: record.email,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deliver(job, config, database, transportFactory) {
  let transport,
    status = "uncertain";
  try {
    transport = transportFactory(config);
    const info = await transport.sendMail({
      from: { name: "Núñez Saldaña S.A.C.", address: config.user },
      to: job.recipient,
      ...deadlineMessage(job, config),
    });
    if (info.accepted?.length) status = "accepted";
  } catch (error) {
    status = error.code === "EAUTH" ? "failed" : "uncertain";
  } finally {
    transport?.close();
  }
  let connection;
  try {
    connection = await database.getConnection();
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
      job.case_id,
    ]);
    await connection.execute(
      "UPDATE deadline_reminders SET status=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
      [status, job.reminderId],
    );
    await recordEvent(
      connection,
      job.case_id,
      "deadline.reminder_result",
      null,
      { deadline_id: job.id, reminder_id: job.reminderId, status },
    );
    await connection.commit();
  } catch {
    await connection?.rollback().catch(() => {});
    console.error("Deadline reminder: persistence_pending");
    status = "pending";
  } finally {
    connection?.release();
  }
  return status;
}

export async function runDeadlineReminders({
  database = db,
  transportFactory = gmailTransport,
  config = mailConfig(),
  clock = Date.now,
} = {}) {
  if (
    config.mode !== "gmail" ||
    !config.configured ||
    !config.deadlineReminders
  )
    return { status: "disabled", attempted: 0 };
  const now = clock();
  const [rows] = await database.execute(
    `SELECT d.id FROM deadlines d JOIN cases c ON c.id=d.case_id JOIN users u ON u.id=c.lawyer_id
    WHERE c.status<>'Atención inicial cerrada' AND u.role IN ('gerencia','abogado') AND d.due_at<=?
    AND NOT EXISTS(SELECT 1 FROM deadline_reminders r WHERE r.deadline_id=d.id AND r.recipient_id=c.lawyer_id AND r.stage=(CASE WHEN d.due_at<=? THEN 'expired' WHEN d.due_at<=? THEN '24h' ELSE '48h' END))
    ORDER BY d.due_at ASC,d.id ASC LIMIT 20`,
    [new Date(now + 172800000), new Date(now), new Date(now + 86400000)],
  );
  const statuses = [];
  for (const row of rows) {
    const job = await claim(database, row.id, clock());
    if (job)
      statuses.push(await deliver(job, config, database, transportFactory));
  }
  return { status: "enabled", attempted: statuses.length, statuses };
}

export function startDeadlineReminders() {
  let stopped = false,
    timer;
  async function tick() {
    try {
      await runDeadlineReminders();
    } catch (error) {
      console.error("Deadline reminders:", error.code || error.name);
    }
    if (!stopped) timer = setTimeout(tick, 60000);
  }
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
