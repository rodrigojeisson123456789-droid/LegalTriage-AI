import { db } from "./db.js";
import bcrypt from "bcryptjs";
import { newUserSchema } from "./users.js";
try {
  const [admins] = await db.query(
    "SELECT id FROM users WHERE role='gerencia' LIMIT 1",
  );
  const input = newUserSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: process.env.ADMIN_ROLE || (admins.length ? "soporte" : "gerencia"),
  });
  if (!admins.length && input.role !== "gerencia")
    throw new Error("La primera cuenta debe ser de Gerencia.");
  await db.execute(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    [
      input.name,
      input.email.toLowerCase(),
      await bcrypt.hash(input.password, 12),
      input.role,
    ],
  );
  console.log("Usuario creado con rol " + input.role + ".");
} catch (error) {
  console.error(
    error.code === "ER_DUP_ENTRY"
      ? "Ya existe ese correo."
      : "No se pudo crear la cuenta. Verifica ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (12 a 72 caracteres) y ADMIN_ROLE (gerencia, abogado o soporte).",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
