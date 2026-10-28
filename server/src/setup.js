import { recordEvent } from "./history.js";
import { recordVersion, evaluationPayload } from "./versions.js";
import { db } from "./db.js";
try {
  await db.query(
    `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL)`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS cases (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, document VARCHAR(11) NOT NULL, email VARCHAR(254) NOT NULL, phone VARCHAR(25) NOT NULL, description TEXT NOT NULL, specialty ENUM('Civil','Corporativo','Familia','Bancario','Indeterminado') NOT NULL, classification_status ENUM('classified','unavailable') NOT NULL, status ENUM('Nuevo','En evaluación') NOT NULL DEFAULT 'Nuevo', lawyer_id INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lawyer_id) REFERENCES users(id))`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS deadlines (id INT AUTO_INCREMENT PRIMARY KEY, case_id INT NOT NULL, title VARCHAR(200) NOT NULL, due_at DATETIME NOT NULL, created_by INT NOT NULL, FOREIGN KEY(case_id) REFERENCES cases(id), FOREIGN KEY(created_by) REFERENCES users(id), INDEX(due_at))`,
  );
  await db.query(`CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL UNIQUE,
  original_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  page_count INT NOT NULL,
  content MEDIUMBLOB NOT NULL,
  analysis_status ENUM('analyzed','unavailable') NOT NULL,
  failure_reason VARCHAR(50) NULL,
  analysis JSON NULL,
  analyzed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES cases(id)
)`);
  // Amplía los ENUM de forma aditiva; conserva el orden y los valores existentes.
  const [columns] = await db.query(
    "SELECT COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cases' AND COLUMN_NAME IN ('specialty','status')",
  );
  if (
    !columns
      .find((c) => c.COLUMN_NAME === "specialty")
      ?.COLUMN_TYPE.includes("'Laboral'")
  )
    await db.query(
      "ALTER TABLE cases MODIFY specialty ENUM('Civil','Corporativo','Familia','Bancario','Indeterminado','Laboral') NOT NULL",
    );
  if (
    !columns
      .find((c) => c.COLUMN_NAME === "status")
      ?.COLUMN_TYPE.includes("'Pendiente de aclaración'")
  )
    await db.query(
      "ALTER TABLE cases MODIFY status ENUM('Nuevo','En evaluación','Pendiente de aclaración') NOT NULL DEFAULT 'Nuevo'",
    );
  const [classificationColumns] = await db.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cases' AND COLUMN_NAME='classification_status'",
  );
  if (!classificationColumns[0].COLUMN_TYPE.includes("'manual'"))
    await db.query(
      "ALTER TABLE cases MODIFY classification_status ENUM('classified','unavailable','manual') NOT NULL",
    );
  await db.query(`CREATE TABLE IF NOT EXISTS clarifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    questions TEXT NOT NULL,
    answer TEXT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    INDEX(case_id),
    FOREIGN KEY(case_id) REFERENCES cases(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);
  const [newStatus] = await db.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cases' AND COLUMN_NAME='status'",
  );
  if (!newStatus[0].COLUMN_TYPE.includes("'En seguimiento judicial'"))
    await db.query(
      "ALTER TABLE cases MODIFY status ENUM('Nuevo','En evaluación','Pendiente de aclaración','En seguimiento judicial','Atención inicial cerrada') NOT NULL DEFAULT 'Nuevo'",
    );
  await db.query(`CREATE TABLE IF NOT EXISTS evaluations (
    case_id INT PRIMARY KEY,
    notes TEXT NOT NULL,
    reply_type ENUM('Respuesta','Propuesta','Cotización') NOT NULL,
    reply_text TEXT NOT NULL,
    amount DECIMAL(10,2) NULL,
    decision ENUM('judicial','close') NOT NULL,
    revision INT NOT NULL,
    updated_by INT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    FOREIGN KEY(case_id) REFERENCES cases(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS response_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_by INT NOT NULL,
    FOREIGN KEY(case_id) REFERENCES cases(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    INDEX(case_id)
  )`);
  await db.query(
    `CREATE TABLE IF NOT EXISTS lawyer_profiles (user_id INT PRIMARY KEY,available BOOLEAN NOT NULL DEFAULT FALSE,FOREIGN KEY(user_id) REFERENCES users(id))`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS lawyer_specialties (user_id INT NOT NULL,specialty ENUM('Civil','Corporativo','Familia','Bancario','Laboral') NOT NULL,PRIMARY KEY(user_id,specialty),FOREIGN KEY(user_id) REFERENCES users(id))`,
  );
  // Añade Penal al final de cada ENUM existente, conservando sus valores y orden.
  for (const table of ["cases", "lawyer_specialties"]) {
    const [types] = await db.execute(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='specialty'",
      [table],
    );
    const type = types[0].COLUMN_TYPE;
    if (!type.includes("'Penal'")) {
      const expanded = type.slice(0, -1) + ",'Penal')";
      await db.query(
        `ALTER TABLE ${table} MODIFY specialty ${expanded} NOT NULL`,
      );
    }
  }
  await db.query(
    `CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY,case_id INT NOT NULL,kind ENUM('clarification','response') NOT NULL,token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,status ENUM('pending','accepted','failed','uncertain') NOT NULL,created_by INT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,token_hash),FOREIGN KEY(case_id) REFERENCES cases(id),FOREIGN KEY(created_by) REFERENCES users(id))`,
  );
  const [roleColumns] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role'",
  );
  if (!roleColumns.length) {
    await db.query(
      "ALTER TABLE users ADD COLUMN role ENUM('gerencia','soporte','abogado') NOT NULL DEFAULT 'soporte'",
    );
    await db.query(
      "UPDATE users u LEFT JOIN lawyer_profiles p ON p.user_id=u.id SET u.role='abogado' WHERE p.available=1 OR EXISTS (SELECT 1 FROM cases c WHERE c.lawyer_id=u.id)",
    );
    const [admins] = await db.query(
      "SELECT id FROM users ORDER BY (LOWER(email)='admin@legaltriage.local') DESC,id ASC LIMIT 1",
    );
    if (admins.length)
      await db.execute("UPDATE users SET role='gerencia' WHERE id=?", [
        admins[0].id,
      ]);
  }
  const [sessionColumns] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='session_version'",
  );
  if (!sessionColumns.length)
    await db.query(
      "ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0",
    );
  await db.query(`CREATE TABLE IF NOT EXISTS case_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor_type ENUM('usuario','sistema','cliente') NOT NULL,
    actor_id INT NULL,
    actor_name VARCHAR(120) NOT NULL,
    actor_role VARCHAR(20) NULL,
    audience ENUM('all','legal') NOT NULL,
    details JSON NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX(case_id,id),
    FOREIGN KEY(case_id) REFERENCES cases(id),
    FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS case_versions (
    event_id INT PRIMARY KEY, kind ENUM('evaluation','document') NOT NULL, payload JSON NOT NULL,
    FOREIGN KEY(event_id) REFERENCES case_events(id) ON DELETE CASCADE
  )`);
  // Preserva únicamente el contenido vigente al migrar; no inventa revisiones perdidas.
  const [caseIds] = await db.query("SELECT id FROM cases ORDER BY id");
  for (const item of caseIds) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("SELECT id FROM cases WHERE id=? FOR UPDATE", [
        item.id,
      ]);
      const [existing] = await connection.execute(
        "SELECT DISTINCT v.kind FROM case_versions v JOIN case_events e ON e.id=v.event_id WHERE e.case_id=?",
        [item.id],
      );
      const kinds = new Set(existing.map((v) => v.kind));
      if (!kinds.has("evaluation")) {
        const [rows] = await connection.execute(
          "SELECT * FROM evaluations WHERE case_id=?",
          [item.id],
        );
        if (rows.length) {
          const row = rows[0];
          const eventId = await recordEvent(
            connection,
            item.id,
            "evaluation.baseline",
            null,
            { revision: row.revision },
          );
          await recordVersion(
            connection,
            eventId,
            "evaluation",
            evaluationPayload(row),
          );
        }
      }
      if (!kinds.has("document")) {
        const [rows] = await connection.execute(
          "SELECT id,original_name,page_count,analysis FROM documents WHERE case_id=? AND analysis IS NOT NULL",
          [item.id],
        );
        if (rows.length) {
          const row = rows[0];
          const eventId = await recordEvent(
            connection,
            item.id,
            "document.baseline",
          );
          await recordVersion(connection, eventId, "document", {
            document_id: row.id,
            name: row.original_name,
            pages: row.page_count,
            analysis:
              typeof row.analysis === "string"
                ? JSON.parse(row.analysis)
                : row.analysis,
          });
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  console.log(
    "Esquema MySQL listo (Laboral, Penal, documentos y aclaraciones; conserva casos existentes).",
  );
} finally {
  await db.end();
}
