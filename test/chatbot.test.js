const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectCountry,
  getSourcesForMessage,
  buildFallbackAnswer,
} = require("../backend/routes/chatbot");

test("detectCountry defaults to France and detects Morocco keywords", () => {
  assert.equal(detectCountry("Comment marche la BRSS ?"), "FR");
  assert.equal(detectCountry("Quels droits CNSS pour AMO au Maroc ?"), "MA");
  assert.equal(detectCountry("Question generale sur mutuelle"), "FR");
});

test("getSourcesForMessage returns fixed official sources by country and topic", () => {
  const franceSources = getSourcesForMessage("FR", "capital deces obseques");
  const marocSources = getSourcesForMessage("MA", "AMO CNSS");

  assert.ok(franceSources.some((source) => source.name === "Service-Public.fr"));
  assert.ok(franceSources.some((source) => source.name === "AGIRA"));
  assert.deepEqual(
    marocSources.map((source) => source.name),
    ["CNSS", "ACAPS"],
  );
});

test("buildFallbackAnswer is structured and mentions Gemma is not connected", () => {
  const answer = buildFallbackAnswer({
    message: "Remboursement consultation",
    country: "FR",
    sources: getSourcesForMessage("FR", "Remboursement consultation"),
  });

  assert.match(answer, /Pays applicable : France/);
  assert.match(answer, /Gemma n'est pas encore connecte/);
  assert.match(answer, /Niveau de confiance : faible/);
});
