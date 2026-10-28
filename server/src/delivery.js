import { db } from "./db.js";
import { recordEvent } from "./history.js";

export async function finishNotification(caseId, id, status, actor) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
      caseId,
    ]);
    await connection.execute(
      "UPDATE notifications SET status=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
      [status, id],
    );
    await recordEvent(connection, caseId, "mail.result", actor, {
      notification_id: id,
      status,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
