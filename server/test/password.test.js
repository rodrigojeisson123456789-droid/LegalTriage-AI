import { test } from "node:test";
import assert from "node:assert/strict";
import { resetPasswordSchema } from "../src/users.js";
import { routeAllowed } from "../src/access.js";
test("restablecer exige confirmación, mínimo seguro y permisos de Gerencia", () => {
  assert.ok(
    resetPasswordSchema.safeParse({
      password: "Clave-prueba-123456",
      confirmation: "Clave-prueba-123456",
    }).success,
  );
  for (const [password, confirmation] of [
    ["corta", "corta"],
    ["Clave-prueba-123456", "otra"],
    ["a".repeat(73), "a".repeat(73)],
    ["á".repeat(40), "á".repeat(40)],
  ])
    assert.equal(
      resetPasswordSchema.safeParse({ password, confirmation }).success,
      false,
    );
  assert.equal(routeAllowed("soporte", "PUT", "/users/1/password"), false);
  assert.equal(routeAllowed("abogado", "PUT", "/users/1/password"), false);
  assert.equal(routeAllowed("gerencia", "PUT", "/users/1/password"), true);
});

import { newUserSchema, changePasswordSchema } from "../src/users.js";
test("se admiten 8 caracteres sin reglas de mayúsculas/números y el cambio propio exige contraseña actual", () => {
  assert.ok(
    newUserSchema.safeParse({
      name: "Abogado prueba",
      email: "test@example.com",
      role: "abogado",
      password: "abcdefgh",
    }).success,
  );
  assert.ok(
    resetPasswordSchema.safeParse({
      password: "abcdefgh",
      confirmation: "abcdefgh",
    }).success,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "abcdefg",
      confirmation: "abcdefg",
    }).success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({
      password: "abcdefgh",
      confirmation: "abcdefgh",
    }).success,
    false,
  );
  for (const role of ["gerencia", "abogado", "soporte"])
    assert.equal(routeAllowed(role, "PUT", "/me/password"), true);
});
