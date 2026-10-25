import { db } from "./db.js";
export const roles = ["gerencia", "soporte", "abogado"];
export class AccessError extends Error {
  constructor(message = "No tienes permiso para esta acción.", status = 403) {
    super(message);
    this.status = status;
  }
}
export function routeAllowed(role, method, path, body = {}) {
  if (!roles.includes(role)) return false;
  if (role === "gerencia") return true;
  if (path === "/me/password" && method === "PUT") return true;
  if (
    ["/me", "/users", "/cases", "/deadlines", "/mail/config"].includes(path) &&
    method === "GET"
  )
    return true;
  if (/^\/cases\/\d+$/.test(path) && method === "PATCH")
    return role === "soporte" || body.lawyer_id === undefined;
  if (path === "/deadlines" && method === "POST") return role === "abogado";
  if (/^\/documents\/\d+\/(download|analyze)$/.test(path))
    return (
      (method === "GET" && path.endsWith("/download")) ||
      (method === "POST" && path.endsWith("/analyze"))
    );
  if (/^\/cases\/\d+\/history$/.test(path)) return method === "GET";
  if (/^\/cases\/\d+\/documents$/.test(path)) return method === "GET";
  if (/^\/cases\/\d+\/clarifications(?:\/\d+)?$/.test(path))
    return ["GET", "POST", "DELETE"].includes(method);
  if (/^\/cases\/\d+\/evaluation(?:\/(approve|share))?$/.test(path))
    return (
      role === "abogado" && ["GET", "PUT", "POST", "DELETE"].includes(method)
    );
  if (/^\/cases\/\d+\/auto-assign$/.test(path))
    return role === "soporte" && method === "POST";
  if (/^\/cases\/\d+\/notifications$/.test(path))
    return (
      method === "GET" ||
      (method === "POST" &&
        (body.kind === "clarification" || role === "abogado"))
    );
  return false;
}
export async function ensureCaseAccess(user, id, connection = db) {
  const [rows] = await connection.execute(
    "SELECT id,lawyer_id FROM cases WHERE id=?",
    [id],
  );
  if (
    !rows.length ||
    (user.role === "abogado" && rows[0].lawyer_id !== user.id)
  )
    throw new AccessError("Caso no disponible para tu cuenta.", 404);
}
export async function authorize(req, res, next) {
  if (!routeAllowed(req.user.role, req.method, req.path, req.body))
    throw new AccessError();
  const match = req.path.match(/^\/cases\/(\d+)(?:\/|$)/);
  if (match) await ensureCaseAccess(req.user, Number(match[1]));
  const document = req.path.match(/^\/documents\/(\d+)\//);
  if (document) {
    const [rows] = await db.execute(
      "SELECT case_id FROM documents WHERE id=?",
      [document[1]],
    );
    if (!rows.length) throw new AccessError("Documento no disponible.", 404);
    await ensureCaseAccess(req.user, rows[0].case_id);
  }
  if (req.path === "/deadlines" && req.method === "POST")
    await ensureCaseAccess(req.user, Number(req.body?.case_id) || 0);
  next();
}
// Revalida permisos de escrituras después de bloquear el caso, incluso tras llamadas lentas a IA.
export async function guardCaseWrite(req, connection, caseId) {
  const [users] = await connection.execute(
    "SELECT id,name,role,session_version FROM users WHERE id=?",
    [req.user.id],
  );
  const user = users[0];
  if (user && user.session_version !== req.user.session_version)
    throw new AccessError(
      "La contraseña cambió. Inicia sesión nuevamente.",
      401,
    );
  if (
    !user ||
    !routeAllowed(
      user.role,
      req.method,
      req.originalUrl.slice(4).split("?")[0],
      req.body,
    )
  )
    throw new AccessError();
  await ensureCaseAccess(user, caseId, connection);
}
