import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSchema, specialties } from "../src/assignment.js";
test("disponibilidad requiere especialidades válidas, distintas y explícitas", () => {
  assert.ok(
    profileSchema.safeParse({
      available: true,
      specialties: ["Laboral", "Civil"],
    }).success,
  );
  assert.ok(
    profileSchema.safeParse({ available: false, specialties: [] }).success,
  );
  for (const input of [
    { available: true, specialties: [] },
    { available: true, specialties: ["Laboral", "Laboral"] },
    { available: true, specialties: ["Indeterminado"] },
    { available: "true", specialties: ["Civil"] },
  ])
    assert.equal(profileSchema.safeParse(input).success, false);
});

test("perfil Penal admite las seis especialidades sin admitir Indeterminado", () => {
  assert.ok(specialties.includes("Penal"));
  assert.ok(
    profileSchema.safeParse({ available: true, specialties: ["Penal"] })
      .success,
  );
  assert.ok(profileSchema.safeParse({ available: true, specialties }).success);
  assert.equal(
    profileSchema.safeParse({
      available: true,
      specialties: ["Penal", "Penal"],
    }).success,
    false,
  );
});
