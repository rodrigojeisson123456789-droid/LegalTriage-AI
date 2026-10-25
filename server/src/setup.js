import {db} from './db.js';
try {
await db.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL)`);
await db.query(`CREATE TABLE IF NOT EXISTS cases (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, document VARCHAR(11) NOT NULL, email VARCHAR(254) NOT NULL, phone VARCHAR(25) NOT NULL, description TEXT NOT NULL, specialty ENUM('Civil','Corporativo','Familia','Bancario','Indeterminado') NOT NULL, classification_status ENUM('classified','unavailable') NOT NULL, status ENUM('Nuevo','En evaluación') NOT NULL DEFAULT 'Nuevo', lawyer_id INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lawyer_id) REFERENCES users(id))`);
await db.query(`CREATE TABLE IF NOT EXISTS deadlines (id INT AUTO_INCREMENT PRIMARY KEY, case_id INT NOT NULL, title VARCHAR(200) NOT NULL, due_at DATETIME NOT NULL, created_by INT NOT NULL, FOREIGN KEY(case_id) REFERENCES cases(id), FOREIGN KEY(created_by) REFERENCES users(id), INDEX(due_at))`);
console.log('Esquema MySQL listo.');
} finally { await db.end(); }
