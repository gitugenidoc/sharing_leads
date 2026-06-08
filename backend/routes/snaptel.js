const express = require("express");
const Client = require("../models/Client");
const CommunicationMessage = require("../models/CommunicationMessage");

const router = express.Router();

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const getFirstNumber = (payload, paths = []) => {
  for (const path of paths) {
    const value = toFiniteNumber(getNestedValue(payload, path));
    if (value !== null) return value;
  }
  return null;
};

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

const normalizeStatus = (value, fallback = "RECEIVED") => {
  const text = toText(value);
  if (!text) return fallback;
  return text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toUpperCase();
};

const normalizeDirection = (value, fallback = "INBOUND") => {
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  if (["outbound", "out", "agent", "callee", "to_client"].includes(text)) {
    return "OUTBOUND";
  }
  if (["inbound", "in", "customer", "caller", "from_client"].includes(text)) {
    return "INBOUND";
  }
  return fallback;
};

const inferDirectionFromEvent = (event) => {
  const text = toText(event).toLowerCase();
  if (text.includes("outbound")) return "OUTBOUND";
  if (text.includes("inbound")) return "INBOUND";
  return "INBOUND";
};

const isSecretAuthorized = (req) => {
  const expected = toText(process.env.SNAPTEL_WEBHOOK_SECRET);
  if (!expected) return true;
  const authorization = toText(req.headers.authorization);
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const candidates = [
    req.headers["x-snaptel-secret"],
    req.headers["x-webhook-secret"],
    req.query.secret,
    req.query.token,
    req.body?.secret,
    req.body?.token,
    bearer,
  ];
  return uniqueTexts(candidates).some((value) => value === expected);
};

const extractPhoneCandidates = (payload) =>
  uniqueTexts([
    getFirstText(payload, ["phone", "customer.phone", "lead.phone", "contact.phone"]),
    getFirstText(payload, ["call.from", "from", "caller", "caller_number", "callerNumber"]),
    getFirstText(payload, ["call.to", "to", "callee", "callee_number", "calleeNumber"]),
    getFirstText(payload, ["agent.phone", "agent.number", "destination.phone"]),
  ]);

const normalizeSnaptelPayload = (payload = {}) => {
  const event =
    getFirstText(payload, [
      "event",
      "type",
      "status",
      "call.event",
      "call.status",
      "data.event",
      "data.status",
    ]) || "call.received";
  const direction = normalizeDirection(
    getFirstText(payload, ["direction", "call.direction", "data.direction"]),
    inferDirectionFromEvent(event),
  );
  const fromNumber = getFirstText(payload, [
    "call.from",
    "from",
    "caller",
    "caller_number",
    "callerNumber",
    "customer.phone",
    "lead.phone",
    "contact.phone",
  ]);
  const toNumber = getFirstText(payload, [
    "call.to",
    "to",
    "callee",
    "callee_number",
    "calleeNumber",
    "agent.phone",
    "agent.number",
    "destination.phone",
  ]);
  const callId = getFirstText(payload, [
    "call.id",
    "callId",
    "call_id",
    "id",
    "data.callId",
    "data.call_id",
  ]);
  const campaignId = getFirstText(payload, [
    "campaign.id",
    "campaignId",
    "campaign_id",
    "data.campaignId",
    "data.campaign_id",
  ]);
  const campaignName = getFirstText(payload, [
    "campaign.name",
    "campaignName",
    "data.campaignName",
  ]);
  const transcript = getFirstText(payload, [
    "transcript",
    "call.transcript",
    "data.transcript",
  ]);
  const summary = getFirstText(payload, [
    "summary",
    "call.summary",
    "data.summary",
    "analysis.summary",
  ]);
  const recordingUrl = getFirstText(payload, [
    "recordingUrl",
    "recording_url",
    "call.recordingUrl",
    "call.recording_url",
    "data.recordingUrl",
    "data.recording_url",
  ]);
  const durationSeconds = getFirstNumber(payload, [
    "duration",
    "durationSeconds",
    "duration_seconds",
    "call.duration",
    "call.durationSeconds",
    "call.duration_seconds",
    "data.duration",
  ]);
  const phoneCandidates = extractPhoneCandidates(payload);
  const status = normalizeStatus(
    getFirstText(payload, ["status", "call.status", "data.status"]) || event,
  );

  const summaryParts = [
    normalizeStatus(event),
    campaignName ? `campaign=${campaignName}` : "",
    fromNumber ? `from=${fromNumber}` : "",
    toNumber ? `to=${toNumber}` : "",
    durationSeconds !== null ? `duration=${durationSeconds}s` : "",
    summary,
    transcript,
  ].filter(Boolean);

  return {
    event,
    status,
    direction,
    fromNumber,
    toNumber,
    callId,
    campaignId,
    campaignName,
    transcript,
    summary,
    recordingUrl,
    durationSeconds,
    phoneCandidates,
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
    timestamp: new Date().toISOString(),
  });
});

router.post("/webhook", async (req, res) => {
  if (!isSecretAuthorized(req)) {
    return res.status(403).json({ error: "Unauthorized webhook request" });
  }

  try {
    const normalized = normalizeSnaptelPayload(req.body || {});
    let matchedClient = null;

    for (const phone of normalized.phoneCandidates) {
      matchedClient = await Client.findClientByPhone(phone);
      if (matchedClient) break;
    }

    const message = await CommunicationMessage.createMessage({
      clientId: matchedClient?.id || null,
      userId: null,
      channel: "CALL",
      direction: normalized.direction,
      status: normalized.status,
      messageType: "call",
      fromNumber: normalized.fromNumber || "",
      toNumber: normalized.toNumber || "",
      body: normalized.note || normalized.status,
      provider: "snaptel",
      providerMessageId: normalized.callId || "",
      rawPayload: {
        normalized,
        payload: req.body || {},
      },
    });

    if (matchedClient) {
      const updatedClient = await Client.updateClient(matchedClient.id, {
        last_contacted_at: new Date(),
        last_action_at: new Date(),
      });
      await Client.addClientHistory({
        clientId: matchedClient.id,
        userId: null,
        action: "SNAPTEL_CALL_EVENT",
        oldValue: { last_contacted_at: matchedClient.last_contacted_at },
        newValue: {
          event: normalized.event,
          status: normalized.status,
          call_id: normalized.callId || null,
          campaign_id: normalized.campaignId || null,
          campaign_name: normalized.campaignName || null,
          direction: normalized.direction,
          provider_message_id: message.provider_message_id || null,
          recording_url: normalized.recordingUrl || null,
          duration_seconds: normalized.durationSeconds,
          last_contacted_at: updatedClient.last_contacted_at,
        },
        note: normalized.note || normalized.status,
      });
    }

    return res.status(200).json({
      ok: true,
      event: normalized.event,
      status: normalized.status,
      matched_client_id: matchedClient?.id || null,
      provider_message_id: message.provider_message_id || null,
      received_at: new Date().toISOString(),
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
