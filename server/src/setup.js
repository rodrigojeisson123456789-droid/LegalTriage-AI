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
  console.log(
    "Esquema MySQL listo (incluye documentos; conserva casos existentes).",
  );
} finally {
  await db.end();
}
