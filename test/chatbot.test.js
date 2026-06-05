const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectCountry,
  getSourcesForMessage,
  buildFallbackAnswer,
  buildGoogleGenAiEndpoint,
  buildGoogleGenAiPayload,
  getGemmaConfig,
  normalizeGemmaResponse,
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

test("getGemmaConfig defaults to Google GenAI with Gemma 4", () => {
  const config = getGemmaConfig({});

  assert.equal(config.apiType, "google_genai");
  assert.equal(config.model, "gemma-4-12b-it");
  assert.equal(config.apiUrl, "https://generativelanguage.googleapis.com/v1beta");
});

test("getGemmaConfig selects OpenRouter when its key is configured", () => {
  const config = getGemmaConfig({
    OPENROUTER_API_KEY: "test-key",
    GEMMA_MODEL: "google/gemma-4-31b-it:free",
  });

  assert.equal(config.apiType, "openrouter");
  assert.equal(config.apiUrl, "https://openrouter.ai/api/v1");
  assert.equal(config.model, "google/gemma-4-31b-it:free");
  assert.equal(config.apiKey, "test-key");
});

test("buildGoogleGenAiPayload maps system and user messages for generateContent", () => {
  const payload = buildGoogleGenAiPayload([
    { role: "system", content: "System prompt" },
    { role: "user", content: "Question" },
  ]);

  assert.equal(payload.systemInstruction.parts[0].text, "System prompt");
  assert.equal(payload.contents[0].role, "user");
  assert.equal(payload.contents[0].parts[0].text, "Question");
  assert.equal(payload.generationConfig.temperature, 0.3);
});

test("buildGoogleGenAiEndpoint supports default and models-prefixed ids", () => {
  assert.equal(
    buildGoogleGenAiEndpoint({
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/",
      model: "gemma-4-12b-it",
    }),
    "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-12b-it:generateContent",
  );
  assert.equal(
    buildGoogleGenAiEndpoint({
      apiUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "models/gemma-4-12b-it",
    }),
    "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-12b-it:generateContent",
  );
});

test("normalizeGemmaResponse reads Google GenAI candidates and strips thought tags", () => {
  const answer = normalizeGemmaResponse(
    {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "<|channel>thought\nprivate reasoning<channel|>Reponse finale",
              },
            ],
          },
        },
      ],
    },
    "google_genai",
  );

  assert.equal(answer, "Reponse finale");
});

test("normalizeGemmaResponse supports OpenRouter chat completions", () => {
  const answer = normalizeGemmaResponse(
    {
      choices: [
        {
          message: {
            content: "Reponse OpenRouter",
          },
        },
      ],
    },
    "openrouter",
  );

  assert.equal(answer, "Reponse OpenRouter");
});
