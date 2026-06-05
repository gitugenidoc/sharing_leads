const express = require("express");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const FRANCE_SOURCES = [
  { name: "Ameli", url: "https://www.ameli.fr" },
  { name: "Service-Public.fr", url: "https://www.service-public.fr" },
  { name: "Legifrance", url: "https://www.legifrance.gouv.fr" },
  { name: "Assurance Maladie", url: "https://assurance-maladie.ameli.fr" },
  { name: "Assurance retraite", url: "https://www.lassuranceretraite.fr" },
  { name: "ACPR Banque de France", url: "https://acpr.banque-france.fr" },
  { name: "AGIRA", url: "https://www.agira.asso.fr" },
];

const MAROC_SOURCES = [
  { name: "CNSS", url: "https://www.cnss.ma" },
  { name: "ACAPS", url: "https://www.acaps.ma" },
];

const FINAL_WARNING =
  "Cette reponse est une aide generale. Verifiez toujours le contrat, le tableau de garanties et les documents officiels avant de prendre une decision.";

const DEFAULT_GEMMA_MODEL = "gemma-4-12b-it";
const GOOGLE_GENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMMA_TEMPERATURE = Number(process.env.GEMMA_TEMPERATURE || 0.3);
const GEMMA_MAX_OUTPUT_TOKENS = Number(process.env.GEMMA_MAX_OUTPUT_TOKENS || 900);
const CHATBOT_MAX_MESSAGE_LENGTH = Number(process.env.CHATBOT_MAX_MESSAGE_LENGTH || 2000);

const detectCountry = (message = "", requestedCountry = "") => {
  const explicit = String(requestedCountry || "").toUpperCase();
  if (["FR", "MA"].includes(explicit)) return explicit;

  const text = String(message).toLowerCase();
  const marocTerms = [
    "cnss",
    "amo",
    "cnops",
    "acaps",
    "maroc",
    "marocaine",
    "takaful",
  ];
  const franceTerms = [
    "cpam",
    "ameli",
    "carte vitale",
    "brss",
    "securite sociale",
    "sécurité sociale",
    "c2s",
    "complementaire sante solidaire",
    "complémentaire santé solidaire",
    "mutuelle obligatoire",
  ];

  if (marocTerms.some((term) => text.includes(term))) return "MA";
  if (franceTerms.some((term) => text.includes(term))) return "FR";
  return "FR";
};

const getSourcesForMessage = (country, message = "") => {
  const text = String(message).toLowerCase();
  const sources = country === "MA" ? [...MAROC_SOURCES] : [...FRANCE_SOURCES];

  if (country === "FR") {
    if (/(deces|décès|obseques|obsèques|agira|funeraire|funéraire)/i.test(text)) {
      return sources.filter((source) =>
        ["Service-Public.fr", "AGIRA", "Assurance retraite"].includes(source.name),
      );
    }
    if (/(acpr|reclamation|réclamation|assurance auto|habitation|emprunteur)/i.test(text)) {
      return sources.filter((source) =>
        ["ACPR Banque de France", "Service-Public.fr", "Legifrance"].includes(source.name),
      );
    }
    if (/(brss|mutuelle|complementaire|complémentaire|ticket moderateur|ticket modérateur)/i.test(text)) {
      return sources.filter((source) =>
        ["Ameli", "Service-Public.fr", "Legifrance"].includes(source.name),
      );
    }
  }

  return sources.slice(0, country === "MA" ? 2 : 4);
};

const buildSystemPrompt = (country) => `
Tu es Coveo Assistant, expert assurance pour SecurAssure.
Marche principal: France. Marche secondaire: Maroc.
Pays applicable actuel: ${country === "MA" ? "Maroc" : "France"}.
Domaines prioritaires: sante, mutuelle, Securite sociale, prevoyance, deces/obseques.
Reponds en francais clair, prudemment, sans inventer de droit ni de garantie.
Structure toujours la reponse avec:
1. Pays applicable
2. Reponse simple
3. Conditions / exceptions
4. Documents necessaires
5. Sources utiles
6. Niveau de confiance
7. Avertissement contrat
Si le pays est ambigu, precise que tu reponds par defaut pour la France.
`;

const buildFallbackAnswer = ({ message, country, sources }) => {
  const countryLabel = country === "MA" ? "Maroc" : "France";
  const sourceNames = sources.map((source) => source.name).join(", ");

  return [
    `Pays applicable : ${countryLabel}`,
    "",
    "Le moteur Gemma n'est pas encore connecte sur ce serveur. Je peux quand meme cadrer la demande pour un conseiller.",
    "",
    `Question recue : ${String(message || "").trim()}`,
    "",
    "A verifier :",
    "- le pays exact de la situation",
    "- le type de garantie ou de contrat",
    "- le tableau de garanties ou la notice",
    "- les justificatifs disponibles",
    "",
    `Sources utiles a consulter : ${sourceNames}.`,
    "",
    `Niveau de confiance : faible tant que le moteur IA et les documents ne sont pas connectes.`,
    FINAL_WARNING,
  ].join("\n");
};

const normalizeGemmaResponse = (payload, apiType) => {
  if (["openai_compatible", "openrouter"].includes(apiType)) {
    return stripGemmaThinking(payload?.choices?.[0]?.message?.content || "");
  }
  if (apiType === "google_genai") {
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    return stripGemmaThinking(parts.map((part) => part.text || "").join("\n"));
  }
  return stripGemmaThinking(payload?.message?.content || payload?.response || "");
};

const stripGemmaThinking = (text = "") =>
  String(text || "")
    .replace(/<\|channel\>thought[\s\S]*?<channel\|>/g, "")
    .replace(/<\|[^>]+?\|>/g, "")
    .trim();

const getGemmaConfig = (env = process.env) => {
  const apiType = env.GEMMA_API_TYPE || (env.OPENROUTER_API_KEY ? "openrouter" : "google_genai");
  const model = env.GEMMA_MODEL || DEFAULT_GEMMA_MODEL;
  const apiKey =
    env.OPENROUTER_API_KEY || env.GEMMA_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
  const apiUrl =
    env.GEMMA_API_URL ||
    (apiType === "google_genai"
      ? GOOGLE_GENAI_BASE_URL
      : apiType === "openrouter"
        ? OPENROUTER_BASE_URL
        : "");

  return { apiType, apiUrl, model, apiKey };
};

const buildGemmaMessages = ({ message, country, sources }) => {
  const sourceText = sources
    .map((source) => `${source.name}: ${source.url}`)
    .join("\n");

  return [
    { role: "system", content: buildSystemPrompt(country) },
    {
      role: "user",
      content: `Sources fixes disponibles:\n${sourceText}\n\nQuestion utilisateur:\n${message}`,
    },
  ];
};

const buildGoogleGenAiPayload = (messages) => {
  const systemMessage = messages.find((message) => message.role === "system")?.content || "";
  const userMessages = messages.filter((message) => message.role !== "system");

  return {
    systemInstruction: {
      parts: [{ text: systemMessage }],
    },
    contents: userMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    generationConfig: {
      temperature: GEMMA_TEMPERATURE,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: GEMMA_MAX_OUTPUT_TOKENS,
    },
  };
};

const buildGoogleGenAiEndpoint = ({ apiUrl, model }) => {
  const base = apiUrl.replace(/\/$/, "");
  const modelPath = String(model || DEFAULT_GEMMA_MODEL).startsWith("models/")
    ? model
    : `models/${model || DEFAULT_GEMMA_MODEL}`;
  return `${base}/${modelPath}:generateContent`;
};

const callGoogleGenAi = async ({ apiUrl, model, apiKey, messages }) => {
  if (!apiKey) return null;

  const response = await fetch(buildGoogleGenAiEndpoint({ apiUrl, model }), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(buildGoogleGenAiPayload(messages)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google GenAI service error: ${response.status} ${errorText}`);
  }

  return normalizeGemmaResponse(await response.json(), "google_genai");
};

const callGemma = async ({ message, country, sources }) => {
  const { apiType, apiUrl, model, apiKey } = getGemmaConfig();

  if (!apiUrl || !model) return null;

  const messages = buildGemmaMessages({ message, country, sources });

  if (apiType === "google_genai") {
    return callGoogleGenAi({ apiUrl, model, apiKey, messages });
  }

  const base = apiUrl.replace(/\/$/, "");
  const endpoint =
    ["openai_compatible", "openrouter"].includes(apiType)
      ? base.endsWith("/chat/completions")
        ? base
        : `${base}/chat/completions`
      : base.endsWith("/api/chat")
        ? base
        : `${base}/api/chat`;
  const headers = { "Content-Type": "application/json" };

  if (["openai_compatible", "openrouter"].includes(apiType) && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (apiType === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_URL || "http://localhost:5000";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "SecurAssure Coveo Assistant";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(
      ["openai_compatible", "openrouter"].includes(apiType)
        ? { model, messages, temperature: GEMMA_TEMPERATURE, max_tokens: GEMMA_MAX_OUTPUT_TOKENS }
        : {
            model,
            messages,
            stream: false,
            options: {
              temperature: GEMMA_TEMPERATURE,
              top_p: 0.95,
              top_k: 64,
              num_predict: GEMMA_MAX_OUTPUT_TOKENS,
            },
          },
    ),
  });

  if (!response.ok) {
    throw new Error(`Gemma service error: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeGemmaResponse(payload, apiType);
};

router.post("/message", verifyToken, async (req, res) => {
  try {
    if (typeof req.body?.message !== "string") {
      return res.status(400).json({ error: "Message must be text" });
    }
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (message.length > CHATBOT_MAX_MESSAGE_LENGTH) {
      return res.status(413).json({
        error: `Message is too long. Maximum is ${CHATBOT_MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    const country = detectCountry(message, req.body?.country);
    const sources = getSourcesForMessage(country, message);
    let answer = await callGemma({ message, country, sources });
    let confidence = "moyen";
    let escalationRecommended = false;

    if (!answer) {
      answer = buildFallbackAnswer({ message, country, sources });
      confidence = "faible";
      escalationRecommended = true;
    }

    res.json({
      answer,
      country,
      sources,
      confidence,
      escalationRecommended,
    });
  } catch (err) {
    console.error("Chatbot error:", err);
    const message = String(req.body?.message || "").trim();
    const country = detectCountry(message, req.body?.country);
    const sources = getSourcesForMessage(country, message);
    res.json({
      answer: buildFallbackAnswer({ message, country, sources }),
      country,
      sources,
      confidence: "faible",
      escalationRecommended: true,
    });
  }
});

module.exports = {
  router,
  detectCountry,
  getSourcesForMessage,
  buildFallbackAnswer,
  buildGemmaMessages,
  buildGoogleGenAiPayload,
  buildGoogleGenAiEndpoint,
  getGemmaConfig,
  normalizeGemmaResponse,
};
