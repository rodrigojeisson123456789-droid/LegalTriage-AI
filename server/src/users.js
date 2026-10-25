import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { roles, AccessError } from "./access.js";
export const usersRouter = Router();
export const newUserSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(roles),
});
usersRouter.post("/users", async (req, res) => {
  const input = newUserSchema.parse(req.body);
  try {
    const [created] = await db.execute(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      [
        input.name,
        input.email.toLowerCase(),
        await bcrypt.hash(input.password, 12),
        input.role,
      ],
    );
    res
      .status(201)
      .json({ id: created.insertId, name: input.name, role: input.role });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ error: "Ya existe una cuenta con ese correo." });
    throw error;
  }
});
usersRouter.put("/users/:id/role", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id),
    { role } = z.object({ role: z.enum(roles) }).parse(req.body),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query(
      "SELECT id,role FROM users ORDER BY id FOR UPDATE",
    );
    if (users.find((u) => u.id === req.user.id)?.role !== "gerencia")
      throw new AccessError();
    if (id === req.user.id)
      throw new AccessError(
        "No puedes cambiar tu propio rol. Otra cuenta de Gerencia debe hacerlo.",
      );
    const target = users.find((u) => u.id === id);
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (
      target.role === "gerencia" &&
      role !== "gerencia" &&
      users.filter((u) => u.role === "gerencia").length <= 1
    ) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: "Debe conservarse al menos una cuenta de Gerencia." });
    }
    if (role === "soporte") {
      const [active] = await connection.execute(
        "SELECT COUNT(*) AS n FROM cases WHERE lawyer_id=? AND status<>'Atención inicial cerrada'",
        [id],
      );
      if (active[0].n) {
        await connection.rollback();
        return res
          .status(409)
          .json({
            error:
              "Reasigna sus casos activos antes de cambiar el rol a Soporte.",
          });
      }
    }
    await connection.execute("UPDATE users SET role=? WHERE id=?", [role, id]);
    if (role === "soporte")
      await connection.execute(
        "UPDATE lawyer_profiles SET available=0 WHERE user_id=?",
        [id],
      );
    await connection.commit();
    res.sendStatus(204);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
