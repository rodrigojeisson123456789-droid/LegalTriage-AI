import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reminderStage,
  deadlineMessage,
  runDeadlineReminders,
} from "../src/deadline-reminders.js";
import { deadlineStatus } from "../../client/src/deadline-status.js";
import { urgency } from "../src/domain.js";
import { eventDetails } from "../src/history.js";
const now = Date.parse("2026-10-31T17:00:00Z");
test("plazos: panel, servidor y correo coinciden en vencimiento y bordes inclusivos 24/48 h", () => {
  for (const [hours, stage, expected] of [
    [-1, "expired", "Vencido"],
    [0, "expired", "Vencido"],
    [0.01, "24h", "Crítico"],
    [24, "24h", "Crítico"],
    [24.01, "48h", "Próximo"],
    [48, "48h", "Próximo"],
    [48.01, null, "Programado"],
  ]) {
    const date = new Date(now + hours * 3600000).toISOString();
    assert.equal(reminderStage(date, now), stage);
    assert.equal(deadlineStatus(date, now).urgency, expected);
    assert.equal(urgency(date, now), expected);
  }
  assert.match(
    deadlineStatus(new Date(now - 3600000), now).remaining,
    /Venció hace 1 h/,
  );
  assert.match(
    deadlineStatus(new Date(now + 1800000), now).remaining,
    /Vence en 30 min/,
  );
  assert.equal(
    deadlineStatus("2026-10-31T12:00:00-05:00", now).urgency,
    "Vencido",
  );
  assert.equal(reminderStage("fecha inválida", now), null);
});
test("correo de plazo contiene actuación y fecha de Lima, sin datos del cliente ni credenciales", () => {
  const message = deadlineMessage(
    {
      stage: "24h",
      case_id: 3,
      title: "Presentar escrito",
      due_at: "2026-11-01T15:00:00Z",
      notes: "NO MOSTRAR",
      document: "12345678",
    },
    {
      origin: "https://legal.example.com",
      local: false,
      password: "NO MOSTRAR",
    },
  );
  assert.match(message.subject, /24 horas/);
  assert.match(message.text, /Presentar escrito/);
  assert.match(message.text, /Lima/);
  assert.match(message.text, /equipo\/plazos/);
  assert.doesNotMatch(JSON.stringify(message), /12345678|NO MOSTRAR/);
  assert.throws(() =>
    eventDetails("deadline.reminder_result", {
      deadline_id: 1,
      reminder_id: 1,
      status: "accepted",
      recipient_email: "privado@example.com",
    }),
  );
});
test("vista previa, desactivación y falta de Gmail no consultan destinatarios ni envían", async () => {
  for (const patch of [
    { mode: "preview" },
    { configured: false },
    { deadlineReminders: false },
  ]) {
    const result = await runDeadlineReminders({
      config: {
        mode: "gmail",
        configured: true,
        deadlineReminders: true,
        ...patch,
      },
      database: { execute: () => assert.fail("No debe reservar avisos") },
      transportFactory: () => assert.fail("No debe enviar"),
    });
    assert.equal(result.attempted, 0);
    assert.equal(result.status, "disabled");
  }
});
