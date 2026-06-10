const http = require("http");
const https = require("https");

const getCampaignWebhookUrl = () =>
  String(process.env.SNAPTEL_CAMPAIGN_WEBHOOK_URL || "").trim();

const getCampaignSecret = () =>
  String(process.env.SNAPTEL_CAMPAIGN_WEBHOOK_SECRET || "").trim();

const getCampaignSecretHeader = () =>
  String(process.env.SNAPTEL_CAMPAIGN_WEBHOOK_SECRET_HEADER || "x-snaptel-secret").trim();

const getSnaptelDataMode = () => {
  const mode = String(process.env.SNAPTEL_DATA_MODE || "minimal").trim().toLowerCase();
  return mode === "full" ? "full" : "minimal";
};

const isConfigured = () => Boolean(getCampaignWebhookUrl());

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizePhone = (phone) =>
  toText(phone)
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");

const parseResponseBody = (text, contentType = "") => {
  if (!text) return {};
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return { raw: text };
    }
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    return { raw: text };
  }
};

const requestJson = async (method, urlString, body = null) => {
  const url = new URL(urlString);
  const transport = url.protocol === "http:" ? http : https;
  const data = body ? Buffer.from(JSON.stringify(body)) : null;
  const secret = getCampaignSecret();
  const secretHeader = getCampaignSecretHeader();
  const headers = {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    "User-Agent": "shareleads-snaptel/1.0",
    ...(data
      ? {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        }
      : {}),
    ...(secret && secretHeader ? { [secretHeader]: secret } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const payload = parseResponseBody(text, res.headers["content-type"] || "");
          const response = {
            statusCode: res.statusCode || 0,
            headers: res.headers,
            payload,
          };
          if ((res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300) {
            resolve(response);
            return;
          }
          const error = new Error(
            payload?.error ||
              payload?.message ||
              payload?.raw ||
              `Snaptel campaign webhook error ${res.statusCode}`,
          );
          error.statusCode = res.statusCode || 500;
          error.providerResponse = payload;
          reject(error);
        });
      },
    );
    req.setTimeout(10000, () => {
      req.destroy(new Error("Snaptel campaign webhook timed out"));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
};

const buildCampaignPayload = ({
  client,
  actor = null,
  user = null,
  toNumber = "",
  message = "",
}) => {
  const normalizedPhone = normalizePhone(toNumber || client?.tel_gsm || client?.tel_professionnel || client?.tel_fixe);
  const actorPhone = normalizePhone(
    actor?.phone_number || user?.phone_number || actor?.sms_sender_number || "",
  );
  const fullName = [toText(client?.prenom), toText(client?.nom)].filter(Boolean).join(" ");
  const address = [toText(client?.adresse), toText(client?.adresse2)].filter(Boolean).join(" ").trim();
  const dataMode = getSnaptelDataMode();
  const includeSensitiveFields = dataMode === "full";

  const payload = {
    event: "campaign.trigger",
    source: "shareleads",
    timestamp: new Date().toISOString(),
    phone: normalizedPhone,
    firstName: toText(client?.prenom),
    lastName: toText(client?.nom),
    fullName,
    message: toText(message),
    leadId: client?.id || null,
    agentName: toText(actor?.name || user?.name),
    agentPhone: actorPhone,
    centerId: client?.center_id || null,
    lead: {
      id: client?.id || null,
      first_name: toText(client?.prenom),
      last_name: toText(client?.nom),
      full_name: fullName,
      phone: normalizedPhone,
      status: toText(client?.status),
    },
    agent: {
      id: actor?.id || user?.id || null,
      name: toText(actor?.name || user?.name),
      phone: actorPhone,
      role: toText(actor?.role || user?.role),
    },
    metadata: {
      provider: "snaptel",
      initiated_from: "shareleads",
      contact_channel: "CALL",
      callback_webhook_path: "/api/snaptel/webhook",
      data_mode: dataMode,
      voice_carrier: "infinivox",
    },
  };

  if (includeSensitiveFields) {
    payload.email = toText(client?.email);
    payload.agentEmail = toText(actor?.email || user?.email);
    payload.centerName = toText(actor?.center_name || user?.center_name);
    payload.lead.email = toText(client?.email);
    payload.lead.address = address;
    payload.lead.city = toText(client?.ville);
    payload.lead.postal_code = toText(client?.code_postal);
    payload.lead.mutual_name = toText(client?.nom_mutuelle || client?.deja_mutuelle);
    payload.lead.mutual_price = client?.prix_mutuelle ?? null;
    payload.lead.notes = toText(client?.notes);
    payload.lead.needs = toText(client?.besoins_specifiques);
    payload.agent.email = toText(actor?.email || user?.email);
  }

  return payload;
};

const triggerCampaignCall = async ({
  client,
  actor = null,
  user = null,
  toNumber = "",
  message = "",
}) => {
  if (!isConfigured()) {
    throw new Error("SNAPTEL_CAMPAIGN_WEBHOOK_URL is not configured");
  }
  const payload = buildCampaignPayload({
    client,
    actor,
    user,
    toNumber,
    message,
  });
  const response = await requestJson("POST", getCampaignWebhookUrl(), payload);
  const providerMessageId =
    response.payload?.id ||
    response.payload?.callId ||
    response.payload?.call_id ||
    response.payload?.requestId ||
    response.payload?.request_id ||
    "";

  return {
    status: "SENT",
    provider: "snaptel_campaign",
    providerMessageId,
    rawPayload: {
      request: payload,
      response: response.payload,
      statusCode: response.statusCode,
    },
  };
};

module.exports = {
  isConfigured,
  buildCampaignPayload,
  triggerCampaignCall,
};
