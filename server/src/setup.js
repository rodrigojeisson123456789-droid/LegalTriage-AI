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
  console.log(
    "Esquema MySQL listo (Laboral, documentos y aclaraciones; conserva casos existentes).",
  );
} finally {
  await db.end();
}
