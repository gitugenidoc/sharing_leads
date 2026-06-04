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
Priorite: France. Marche secondaire: Maroc.
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
  if (apiType === "openai_compatible") {
    return payload?.choices?.[0]?.message?.content || "";
  }
  return payload?.message?.content || payload?.response || "";
};

const callGemma = async ({ message, country, sources }) => {
  const apiUrl = process.env.GEMMA_API_URL;
  const model = process.env.GEMMA_MODEL;
  const apiType = process.env.GEMMA_API_TYPE || "ollama";

  if (!apiUrl || !model) return null;

  const sourceText = sources
    .map((source) => `${source.name}: ${source.url}`)
    .join("\n");
  const messages = [
    { role: "system", content: buildSystemPrompt(country) },
    {
      role: "user",
      content: `Sources fixes disponibles:\n${sourceText}\n\nQuestion utilisateur:\n${message}`,
    },
  ];

  const base = apiUrl.replace(/\/$/, "");
  const endpoint =
    apiType === "openai_compatible"
      ? base.endsWith("/chat/completions")
        ? base
        : `${base}/chat/completions`
      : base.endsWith("/api/chat")
        ? base
        : `${base}/api/chat`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      apiType === "openai_compatible"
        ? { model, messages, temperature: 0.2 }
        : { model, messages, stream: false, options: { temperature: 0.2 } },
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
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
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
};
