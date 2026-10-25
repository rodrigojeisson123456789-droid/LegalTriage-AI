import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
import jwt from "jsonwebtoken";
const base = "http://127.0.0.1:3002/api",
  suffix = randomBytes(6).toString("hex"),
  oldPassword = randomBytes(24).toString("hex"),
  newPassword = randomBytes(24).toString("hex");
let child;
const users = [];
async function req(cookie, path, method = "GET", body) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function login(email, password) {
  return req(null, "/login", "POST", { email, password });
}
try {
  child = spawn(process.execPath, ["src/index.js"], {
    env: { ...process.env, PORT: "3002", GEMINI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error("API no inició");
    try {
      if ((await req(null, "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready);
  for (const role of ["gerencia", "abogado", "soporte"]) {
    const email = role + "-" + suffix + "@example.com";
    const [u] = await db.execute(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      ["Prueba contraseña", email, await bcrypt.hash(oldPassword, 12), role],
    );
    const r = await login(email, oldPassword);
    users.push({
      id: u.insertId,
      email,
      cookie: r.headers.get("set-cookie").split(";")[0],
    });
  }
  const [manager, lawyer, support] = users,
    path = `/users/${lawyer.id}/password`,
    input = { password: newPassword, confirmation: newPassword };
  assert.equal((await req(lawyer.cookie, path, "PUT", input)).status, 403);
  assert.equal((await req(support.cookie, path, "PUT", input)).status, 403);
  assert.equal(
    (
      await req(manager.cookie, path, "PUT", {
        ...input,
        confirmation: "diferente",
      })
    ).status,
    400,
  );
  // La cookie anterior a esta migración sigue funcionando hasta el primer reset.
  const legacy =
    "session=" +
    jwt.sign({ id: lawyer.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal((await req(legacy, "/me")).status, 200);
  assert.equal((await req(manager.cookie, path, "PUT", input)).status, 200);
  assert.equal((await login(lawyer.email, oldPassword)).status, 401);
  assert.equal((await req(lawyer.cookie, "/me")).status, 401);
  assert.equal((await req(legacy, "/me")).status, 401);
  const fresh = await login(lawyer.email, newPassword);
  assert.equal(fresh.status, 200);
  assert.equal(
    (await req(fresh.headers.get("set-cookie").split(";")[0], "/me")).status,
    200,
  );
  const [rows] = await db.execute(
    "SELECT password_hash,session_version FROM users WHERE id=?",
    [lawyer.id],
  );
  assert.notEqual(rows[0].password_hash, newPassword);
  assert.equal(rows[0].session_version, 1);
  assert.ok(await bcrypt.compare(newPassword, rows[0].password_hash));
  const self = await req(
    manager.cookie,
    `/users/${manager.id}/password`,
    "PUT",
    input,
  );
  assert.equal((await self.json()).self, true);
  assert.equal((await req(manager.cookie, "/me")).status, 401);
  assert.equal((await login(manager.email, newPassword)).status, 200);
  console.log(
    "Password smoke OK: solo Gerencia, confirmación, bcrypt, contraseña antigua rechazada, revocación de cookies antiguas/actuales, nuevo acceso y cambio propio.",
  );
} finally {
  child?.kill();
  for (const u of users)
    await db.execute("DELETE FROM users WHERE id=?", [u.id]);
  await db.end();
}
