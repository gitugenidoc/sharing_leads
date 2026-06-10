const pool = require("../config/db");
const Client = require("../models/Client");
const CommunicationMessage = require("../models/CommunicationMessage");
const PhoneCall = require("../models/PhoneCall");
const SnaptelIntegration = require("../models/SnaptelIntegration");
const { timingSafeEqual } = require("../utils/secretCrypto");
const { normalizePhoneDigits } = require("../utils/phoneNormalize");
const { publishCallEvent } = require("./callEventBus");

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

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
    const raw = getNestedValue(payload, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const KNOWN_EVENTS = new Set([
  "ringing",
  "incoming_call",
  "outgoing_call",
  "answered",
  "missed",
  "ended",
  "recording_available",
]);

const normalizeEventType = (value) => {
  const text = toText(value)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toLowerCase();
  if (KNOWN_EVENTS.has(text)) return text;
  if (text.includes("ring")) return "ringing";
  if (text.includes("answer")) return "answered";
  if (text.includes("miss")) return "missed";
  if (text.includes("end") || text.includes("complete") || text.includes("hangup")) {
    return "ended";
  }
  if (text.includes("record")) return "recording_available";
  if (text.includes("outbound") || text.includes("outgoing")) return "outgoing_call";
  if (text.includes("inbound") || text.includes("incoming")) return "incoming_call";
  return text || "ringing";
};

const normalizeDirection = (value, eventType) => {
  const text = toText(value).toLowerCase();
  if (["outbound", "out", "outgoing", "agent", "callee", "to_client"].includes(text)) {
    return "OUTBOUND";
  }
  if (["inbound", "in", "incoming"].includes(text)) return "INBOUND";
  if (eventType === "outgoing_call") return "OUTBOUND";
  if (eventType === "incoming_call") return "INBOUND";
  return "INBOUND";
};

const parseCallPayload = (payload = {}) => {
  const eventType = normalizeEventType(
    getFirstText(payload, [
      "event_type",
      "event",
      "type",
      "status",
      "call.event",
      "call.status",
      "data.event",
    ]),
  );
  const direction = normalizeDirection(
    getFirstText(payload, ["direction", "call.direction", "data.direction"]),
    eventType,
  );
  const callerNumber = getFirstText(payload, [
    "caller_number",
    "callerNumber",
    "call.from",
    "from",
    "caller",
    "customer.phone",
    "lead.phone",
  ]);
  const calleeNumber = getFirstText(payload, [
    "callee_number",
    "calleeNumber",
    "call.to",
    "to",
    "callee",
    "agent.phone",
    "agent.number",
  ]);
  const sda = getFirstText(payload, ["sda", "did", "sda_did", "line", "data.sda"]);
  const agentExtension = getFirstText(payload, [
    "agent_extension",
    "agentExtension",
    "agent.extension",
    "extension",
  ]);
  const agentId = getFirstText(payload, [
    "agent_id",
    "agentId",
    "agent.id",
    "agent_external_id",
  ]);
  const externalClientId = getFirstText(payload, [
    "external_id",
    "lead_id",
    "client_id",
    "metadata.client_id",
    "metadata.lead_id",
  ]);

  return {
    callId:
      getFirstText(payload, [
        "call_id",
        "callId",
        "call.id",
        "id",
        "data.call_id",
      ]) || `snaptel_${Date.now()}`,
    eventType,
    direction,
    callerNumber,
    calleeNumber,
    sda,
    agentExtension,
    agentId,
    callStatus: getFirstText(payload, ["call_status", "status", "call.status"]) || eventType,
    startedAt: getFirstText(payload, ["started_at", "startedAt", "call.started_at"]),
    answeredAt: getFirstText(payload, ["answered_at", "answeredAt", "call.answered_at"]),
    endedAt: getFirstText(payload, ["ended_at", "endedAt", "call.ended_at"]),
    durationSeconds: getFirstNumber(payload, [
      "duration_seconds",
      "durationSeconds",
      "duration",
      "call.duration",
    ]),
    recordingUrl: getFirstText(payload, [
      "recording_url",
      "recordingUrl",
      "call.recording_url",
    ]),
    externalClientId,
    rawPayload: payload,
  };
};

const getRemotePhone = (parsed) => {
  if (parsed.direction === "OUTBOUND") {
    return parsed.calleeNumber || parsed.callerNumber;
  }
  return parsed.callerNumber || parsed.calleeNumber;
};

const matchClients = async (phone, centerId, externalClientId = "") => {
  if (externalClientId) {
    const client = await Client.getClientById(externalClientId);
    if (client && (!centerId || client.center_id === centerId)) {
      return [client];
    }
  }
  return Client.findClientsByPhone(phone, centerId);
};

const buildMatchCandidate = (client) => ({
  type: "client",
  id: client.id,
  name: `${client.prenom || ""} ${client.nom || ""}`.trim() || "Client",
  phone: client.tel_gsm || client.tel_fixe || client.tel_professionnel || "",
  status: client.status,
  company: client.nom_mutuelle || client.profession || "",
});

const verifyWebhookSecret = async (integrationRow, providedSecret, legacyEnvSecret = "") => {
  const stored = await SnaptelIntegration.getWebhookSecret(integrationRow);
  if (stored && providedSecret && timingSafeEqual(stored, providedSecret)) {
    return true;
  }
  const legacy = toText(legacyEnvSecret || process.env.SNAPTEL_WEBHOOK_SECRET);
  if (legacy && providedSecret && timingSafeEqual(legacy, providedSecret)) {
    return true;
  }
  if (!stored && !legacy) return true;
  return false;
};

const resolveIntegration = async (parsed, centerIdHint = null) => {
  if (centerIdHint) {
    const integration = await SnaptelIntegration.getIntegrationByCenterId(centerIdHint);
    if (integration) {
      return SnaptelIntegration.getIntegrationById(integration.id);
    }
  }
  if (parsed.sda) {
    const bySda = await SnaptelIntegration.findIntegrationBySda(parsed.sda);
    if (bySda) return bySda;
  }
  return SnaptelIntegration.getFirstEnabledIntegration();
};

const buildRealtimePayload = (phoneCall, client, parsed) => ({
  phone_call_id: phoneCall.id,
  call_id: phoneCall.call_id,
  event_type: phoneCall.event_type,
  direction: phoneCall.direction,
  caller_number: phoneCall.caller_number,
  callee_number: phoneCall.callee_number,
  match_status: phoneCall.match_status,
  is_unrecognized: phoneCall.is_unrecognized,
  match_candidates: phoneCall.match_candidates || [],
  client: client
    ? {
        id: client.id,
        nom: client.nom,
        prenom: client.prenom,
        status: client.status,
        tel_gsm: client.tel_gsm,
        nom_mutuelle: client.nom_mutuelle,
        nlp_score: client.nlp_score,
        nlp_label: client.nlp_label,
        reminder_at: client.reminder_at,
        notes: client.notes,
      }
    : null,
  recording_url: phoneCall.recording_url,
  duration_seconds: phoneCall.duration_seconds,
  timestamp: new Date().toISOString(),
  is_test: phoneCall.is_test,
});

const processSnaptelCallEvent = async ({
  payload = {},
  providedSecret = "",
  centerIdHint = null,
  isTest = false,
  legacyMode = false,
}) => {
  const parsed = parseCallPayload(payload);
  const integrationRow = legacyMode
    ? await SnaptelIntegration.getFirstEnabledIntegration()
    : await resolveIntegration(parsed, centerIdHint);

  const integrationId = integrationRow?.id || null;
  const centerId = integrationRow?.center_id || centerIdHint || null;

  const authorized = integrationRow
    ? await verifyWebhookSecret(integrationRow, providedSecret)
    : toText(process.env.SNAPTEL_WEBHOOK_SECRET)
      ? timingSafeEqual(toText(process.env.SNAPTEL_WEBHOOK_SECRET), providedSecret)
      : Boolean(legacyMode) || !toText(providedSecret);

  if (integrationRow && !integrationRow.enabled && !isTest) {
    await SnaptelIntegration.logWebhook({
      centerId,
      integrationId,
      status: "REJECTED",
      errorText: "Integration disabled",
      callId: parsed.callId,
      eventType: parsed.eventType,
    });
    return { status: 403, body: { error: "snaptel_integration_disabled" } };
  }

  if (!authorized) {
    await SnaptelIntegration.logWebhook({
      centerId,
      integrationId,
      status: "REJECTED",
      errorText: "Invalid or missing X-Snaptel-Secret",
      callId: parsed.callId,
      eventType: parsed.eventType,
    });
    return { status: 401, body: { error: "Unauthorized webhook request" } };
  }

  if (!centerId && !legacyMode) {
    await SnaptelIntegration.logWebhook({
      centerId: null,
      integrationId,
      status: "ERROR",
      errorText: "No integration configured for this center",
      callId: parsed.callId,
      eventType: parsed.eventType,
      rawPayload: payload,
    });
    return { status: 400, body: { error: "snaptel_integration_not_configured" } };
  }

  const effectiveCenterId = centerId || (await SnaptelIntegration.getFirstEnabledIntegration())?.center_id;
  if (!effectiveCenterId) {
    return await processLegacyOnly(parsed, payload, isTest);
  }

  const agentMapping = await SnaptelIntegration.findAgentByExtension(
    effectiveCenterId,
    parsed.agentExtension,
    parsed.agentId,
  );
  const agentUserId = agentMapping?.user_id || null;

  const remotePhone = getRemotePhone(parsed);
  const matches = await matchClients(remotePhone, effectiveCenterId, parsed.externalClientId);
  const candidates = matches.map(buildMatchCandidate);

  let matchedClient = null;
  let matchStatus = "PENDING";
  let isUnrecognized = false;

  if (candidates.length === 1) {
    matchedClient = matches[0];
    matchStatus = "MATCHED";
  } else if (candidates.length > 1) {
    matchStatus = "MULTIPLE";
  } else {
    matchStatus = "UNMATCHED";
    isUnrecognized = true;
  }

  const phoneCall = await PhoneCall.upsertCallEvent({
    centerId: effectiveCenterId,
    integrationId,
    callId: parsed.callId,
    eventType: parsed.eventType,
    direction: parsed.direction,
    callerNumber: parsed.callerNumber,
    calleeNumber: parsed.calleeNumber,
    sda: parsed.sda,
    agentExtension: parsed.agentExtension,
    agentUserId,
    callStatus: parsed.callStatus,
    startedAt: parsed.startedAt,
    answeredAt: parsed.answeredAt,
    endedAt: parsed.endedAt,
    durationSeconds: parsed.durationSeconds,
    recordingUrl: parsed.recordingUrl,
    matchedClientId: matchedClient?.id || null,
    matchStatus,
    matchCandidates: candidates,
    isTest,
    isUnrecognized,
    rawPayload: { normalized: parsed, payload },
  });

  if (matchedClient) {
    await CommunicationMessage.createMessage({
      clientId: matchedClient.id,
      userId: agentUserId,
      channel: "CALL",
      direction: parsed.direction,
      status: parsed.eventType.toUpperCase(),
      messageType: "call",
      fromNumber: parsed.callerNumber,
      toNumber: parsed.calleeNumber,
      body: `Appel Snaptel: ${parsed.eventType}`,
      provider: "snaptel",
      providerMessageId: `${parsed.callId}:${parsed.eventType}`,
      rawPayload: { phone_call_id: phoneCall.id, normalized: parsed },
    });

    await Client.updateClient(matchedClient.id, {
      last_contacted_at: new Date(),
      last_action_at: new Date(),
    });

    await Client.addClientHistory({
      clientId: matchedClient.id,
      userId: agentUserId,
      action: "SNAPTEL_CALL_EVENT",
      oldValue: {},
      newValue: {
        phone_call_id: phoneCall.id,
        event_type: parsed.eventType,
        call_id: parsed.callId,
        direction: parsed.direction,
        caller_number: parsed.callerNumber,
        callee_number: parsed.calleeNumber,
        agent_extension: parsed.agentExtension,
        duration_seconds: parsed.durationSeconds,
        recording_url: parsed.recordingUrl,
        call_status: parsed.callStatus,
      },
      note: `Appel ${parsed.direction === "INBOUND" ? "entrant" : "sortant"} - ${parsed.eventType}`,
    });
  }

  if (integrationId) {
    await SnaptelIntegration.updateIntegrationStatus(integrationId, {
      status: integrationRow?.enabled ? "ACTIVE" : "NOT_CONFIGURED",
      lastEventAt: new Date(),
    });
  }

  await SnaptelIntegration.logWebhook({
    centerId: effectiveCenterId,
    integrationId,
    status: "ACCEPTED",
    callId: parsed.callId,
    eventType: parsed.eventType,
  });

  const realtimePayload = buildRealtimePayload(phoneCall, matchedClient, parsed);

  if (agentUserId) {
    publishCallEvent(agentUserId, realtimePayload);
  } else {
    const admins = await pool.query(
      `SELECT id FROM users
       WHERE center_id = $1 AND role IN ('ADMIN', 'SUPERVISOR')`,
      [effectiveCenterId],
    );
    const alertPayload = {
      ...realtimePayload,
      alert: "call_without_agent_mapping",
    };
    for (const row of admins.rows) {
      publishCallEvent(row.id, alertPayload);
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      phone_call_id: phoneCall.id,
      call_id: parsed.callId,
      event_type: parsed.eventType,
      match_status: matchStatus,
      matched_client_id: matchedClient?.id || null,
      agent_user_id: agentUserId,
      is_unrecognized: isUnrecognized,
    },
  };
};

const processLegacyOnly = async (parsed, payload, isTest) => {
  let matchedClient = null;
  const remotePhone = getRemotePhone(parsed);
  const matches = await matchClients(remotePhone, null, parsed.externalClientId);
  if (matches.length === 1) matchedClient = matches[0];

  const message = await CommunicationMessage.createMessage({
    clientId: matchedClient?.id || null,
    userId: null,
    channel: "CALL",
    direction: parsed.direction,
    status: parsed.eventType.toUpperCase(),
    messageType: "call",
    fromNumber: parsed.callerNumber,
    toNumber: parsed.calleeNumber,
    body: `Appel Snaptel: ${parsed.eventType}`,
    provider: "snaptel",
    providerMessageId: parsed.callId,
    rawPayload: { normalized: parsed, payload },
  });

  if (matchedClient) {
    await Client.addClientHistory({
      clientId: matchedClient.id,
      userId: null,
      action: "SNAPTEL_CALL_EVENT",
      oldValue: {},
      newValue: {
        event_type: parsed.eventType,
        call_id: parsed.callId,
        provider_message_id: message.provider_message_id,
      },
      note: `Appel Snaptel ${parsed.eventType}`,
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      matched_client_id: matchedClient?.id || null,
      provider_message_id: message.provider_message_id,
      legacy: true,
    },
  };
};

module.exports = {
  parseCallPayload,
  normalizeEventType,
  normalizeDirection,
  processSnaptelCallEvent,
  verifyWebhookSecret,
  buildMatchCandidate,
  __test__: {
    parseCallPayload,
    normalizeEventType,
    getRemotePhone,
  },
};
