const express = require("express");
const {
  processSnaptelCallEvent,
  parseCallPayload,
  normalizeDirection,
  normalizeEventType,
} = require("../services/snaptelWebhookService");
const { timingSafeEqual } = require("../utils/secretCrypto");

const router = express.Router();

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const uniqueTexts = (values = []) => {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = toText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
};

const isSecretAuthorized = (req) => {
  const expected = toText(process.env.SNAPTEL_WEBHOOK_SECRET);
  if (!expected) return true;
  const authorization = toText(req.headers.authorization);
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const candidates = uniqueTexts([
    req.headers["x-snaptel-secret"],
    req.headers["x-webhook-secret"],
    req.query.secret,
    req.query.token,
    req.body?.secret,
    req.body?.token,
    bearer,
  ]);
  return candidates.some((value) => timingSafeEqual(value, expected));
};

const extractWebhookSecret = (req) => {
  const authorization = toText(req.headers.authorization);
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  return (
    toText(req.headers["x-snaptel-secret"]) ||
    toText(req.headers["x-webhook-secret"]) ||
    toText(req.query.secret) ||
    toText(req.body?.secret) ||
    bearer
  );
};

const normalizeStatus = (value, fallback = "RECEIVED") => {
  const text = toText(value);
  if (!text) return fallback;
  return text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toUpperCase();
};

const getNestedValue = (payload, path) => {
  if (!payload || !path) return undefined;
  return path.split(".").reduce((current, part) => {
    if (current === undefined || current === null) return undefined;
    return current[part];
  }, payload);
};

const getFirstText = (payload, paths = []) => {
  for (const path of paths) {
    const value = toText(getNestedValue(payload, path));
    if (value) return value;
  }
  return "";
};

const normalizeSnaptelPayload = (payload = {}) => {
  const parsed = parseCallPayload(payload);
  const campaignId = getFirstText(payload, [
    "campaign.id",
    "campaignId",
    "campaign_id",
    "data.campaignId",
  ]);
  const campaignName = getFirstText(payload, [
    "campaign.name",
    "campaignName",
    "data.campaignName",
  ]);
  const summary = getFirstText(payload, [
    "summary",
    "call.summary",
    "data.summary",
    "analysis.summary",
  ]);
  const transcript = getFirstText(payload, [
    "transcript",
    "call.transcript",
    "data.transcript",
  ]);
  const summaryParts = [
    normalizeStatus(parsed.eventType),
    campaignName ? `campaign=${campaignName}` : "",
    parsed.callerNumber ? `from=${parsed.callerNumber}` : "",
    parsed.calleeNumber ? `to=${parsed.calleeNumber}` : "",
    parsed.durationSeconds !== null ? `duration=${parsed.durationSeconds}s` : "",
    summary,
    transcript,
  ].filter(Boolean);

  return {
    event: parsed.eventType,
    status: normalizeStatus(parsed.callStatus, parsed.eventType.toUpperCase()),
    direction: parsed.direction,
    fromNumber: parsed.callerNumber,
    toNumber: parsed.calleeNumber,
    callId: parsed.callId,
    campaignId,
    campaignName,
    transcript,
    summary,
    recordingUrl: parsed.recordingUrl,
    durationSeconds: parsed.durationSeconds,
    phoneCandidates: uniqueTexts([parsed.callerNumber, parsed.calleeNumber]),
    note: summaryParts.join(" | ").slice(0, 1500),
  };
};

router.get("/webhook", (req, res) => {
  if (!isSecretAuthorized(req)) {
    return res.status(403).json({ error: "Unauthorized webhook request" });
  }

  return res.json({
    ok: true,
    provider: "snaptel",
    webhook: "/api/snaptel/webhook",
    new_webhook: "/api/webhooks/snaptel/call-event",
    timestamp: new Date().toISOString(),
  });
});

router.post("/webhook", async (req, res) => {
  if (!isSecretAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized webhook request" });
  }

  try {
    const result = await processSnaptelCallEvent({
      payload: req.body || {},
      providedSecret: extractWebhookSecret(req),
      legacyMode: true,
    });
    const body = result.body || {};
    return res.status(result.status).json({
      ok: body.ok !== false,
      event: body.event_type || parseCallPayload(req.body).eventType,
      status: body.match_status || "RECEIVED",
      matched_client_id: body.matched_client_id || null,
      provider_message_id: body.phone_call_id || body.provider_message_id || null,
      received_at: new Date().toISOString(),
      ...(body.error ? { error: body.error } : {}),
    });
  } catch (err) {
    console.error("[Snaptel Webhook]", err);
    return res.status(200).json({
      ok: false,
      error: "snaptel_webhook_processing_failed",
    });
  }
});

module.exports = router;
module.exports.__test__ = {
  normalizeSnaptelPayload,
  normalizeDirection,
  normalizeStatus,
  isSecretAuthorized,
};
