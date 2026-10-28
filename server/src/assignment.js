import { recordEvent } from "./history.js";
import { Router } from "express";
import { z } from "zod";
import { db } from "./db.js";
export const specialties = [
  "Civil",
  "Corporativo",
  "Familia",
  "Bancario",
  "Laboral",
  "Penal",
];
export const profileSchema = z
  .object({
    available: z.boolean(),
    specialties: z
      .array(z.enum(specialties))
      .max(specialties.length)
      .refine((v) => new Set(v).size === v.length, {
        message: "No repitas especialidades.",
      }),
  })
  .refine((v) => !v.available || v.specialties.length > 0, {
    message: "Para estar disponible, selecciona al menos una especialidad.",
  });
// Debe llamarse dentro de una transacción. Bloquea caso y luego usuarios en orden.
export async function autoAssign(connection, caseId, actor = null) {
  const [cases] = await connection.execute(
    "SELECT lawyer_id,specialty,status,classification_status FROM cases WHERE id=? FOR UPDATE",
    [caseId],
  );
  const row = cases[0];
  if (!row) return { reason: "not_found" };
  if (row.lawyer_id)
    return { reason: "already_assigned", lawyer_id: row.lawyer_id };
  if (row.status === "Atención inicial cerrada") return { reason: "closed" };
  if (
    row.classification_status === "unavailable" ||
    !specialties.includes(row.specialty)
  )
    return { reason: "needs_review" };
  // Serializa decisiones automáticas y cambios de disponibilidad en estudios pequeños.
  await connection.query("SELECT id FROM users ORDER BY id FOR UPDATE");
  const [candidates] = await connection.execute(
    `SELECT u.id,u.name,COUNT(c.id) AS active_cases FROM users u
 JOIN lawyer_profiles p ON p.user_id=u.id AND p.available=1 AND u.role IN ('gerencia','abogado')
 JOIN lawyer_specialties s ON s.user_id=u.id AND s.specialty=?
 LEFT JOIN cases c ON c.lawyer_id=u.id AND c.status<>'Atención inicial cerrada'
 GROUP BY u.id,u.name ORDER BY active_cases ASC,u.id ASC LIMIT 1`,
    [row.specialty],
  );
  if (!candidates.length) return { reason: "no_match" };
  await connection.execute(
    "UPDATE cases SET lawyer_id=? WHERE id=? AND lawyer_id IS NULL",
    [candidates[0].id, caseId],
  );
  await recordEvent(connection, caseId, "assignment.auto", actor, {
    lawyer_id: candidates[0].id,
    lawyer_name: candidates[0].name,
  });
  return { reason: "assigned", lawyer_id: candidates[0].id };
}
export const assignment = Router();
assignment.get("/team", async (req, res) => {
  const [users] =
    await db.query(`SELECT u.id,u.name,u.email,u.role,COALESCE(p.available,0) AS available,
 (SELECT COUNT(*) FROM cases c WHERE c.lawyer_id=u.id AND c.status<>'Atención inicial cerrada') AS active_cases
 FROM users u LEFT JOIN lawyer_profiles p ON p.user_id=u.id ORDER BY u.name`);
  const [areas] = await db.query(
    "SELECT user_id,specialty FROM lawyer_specialties",
  );
  res.set("Cache-Control", "no-store").json(
    users.map((u) => ({
      ...u,
      available: !!u.available,
      specialties: areas
        .filter((a) => a.user_id === u.id)
        .map((a) => a.specialty),
    })),
  );
});
assignment.put("/team/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id),
    input = profileSchema.parse(req.body),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      "SELECT id,role FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    if (!users.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (input.available && users[0].role === "soporte") {
      await connection.rollback();
      return res.status(409).json({
        error:
          "Soporte no recibe asignaciones jurídicas. Cambia primero su rol a Abogado.",
      });
    }
    await connection.execute(
      "INSERT INTO lawyer_profiles (user_id,available) VALUES (?,?) ON DUPLICATE KEY UPDATE available=VALUES(available)",
      [id, input.available],
    );
    await connection.execute("DELETE FROM lawyer_specialties WHERE user_id=?", [
      id,
    ]);
    for (const specialty of input.specialties)
      await connection.execute(
        "INSERT INTO lawyer_specialties (user_id,specialty) VALUES (?,?)",
        [id, specialty],
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
assignment.post("/cases/:id/auto-assign", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await autoAssign(connection, id, req.user);
    await connection.commit();
    const messages = {
      not_found: "Caso no encontrado.",
      already_assigned:
        "El caso ya tiene responsable. Usa el selector para cambiarlo manualmente.",
      closed: "La atención está cerrada.",
      needs_review:
        "Revisa primero la especialidad: el caso no tiene una clasificación utilizable.",
      no_match:
        "No hay abogados disponibles para esta especialidad. Configura Equipo o asigna manualmente.",
    };
    if (result.reason !== "assigned")
      return res
        .status(result.reason === "not_found" ? 404 : 409)
        .json({ error: messages[result.reason], reason: result.reason });
    res.json(result);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
