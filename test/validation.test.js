const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateClient,
  validateStatus,
  validateUser,
} = require("../backend/middleware/validation-mutuelle");

test("validateClient accepts a complete client", () => {
  const validation = validateClient({
    nom: "Martin",
    prenom: "Jean",
    adresse: "123 Rue de la Paix",
    ville: "Paris",
    code_postal: "75001",
    nom_mutuelle: "Mutuelle France",
    prix_mutuelle: 45.5,
    status: "NEW",
  });

  assert.equal(validation.isValid, true);
  assert.deepEqual(validation.errors, []);
});

test("validateClient rejects missing and malformed fields", () => {
  const validation = validateClient({
    nom: "M",
    prenom: "",
    adresse: "Rue",
    ville: "P",
    code_postal: "7500A",
    nom_mutuelle: "",
    prix_mutuelle: 0,
    status: "INVALID",
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join(" "), /Nom/);
  assert.match(validation.errors.join(" "), /Postal code/);
  assert.match(validation.errors.join(" "), /Status/);
});

test("validateStatus only allows supported workflow values", () => {
  assert.equal(validateStatus("NEW"), true);
  assert.equal(validateStatus("CONTACTED"), true);
  assert.equal(validateStatus("ARCHIVED"), false);
});

test("validateUser accepts valid supported roles", () => {
  assert.equal(
    validateUser({
      email: "admin@example.com",
      name: "Admin User",
      password: "secret123",
      role: "SUPER_ADMIN",
    }).isValid,
    true,
  );
  assert.equal(
    validateUser({
      email: "center@example.com",
      name: "Center Admin",
      password: "secret123",
      role: "ADMIN",
    }).isValid,
    true,
  );
});

test("validateUser rejects weak account data", () => {
  const validation = validateUser({
    email: "bad-email",
    name: "A",
    password: "123",
    role: "OWNER",
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.length, 4);
});
