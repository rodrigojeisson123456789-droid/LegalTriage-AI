import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../src/assignment.js";
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
