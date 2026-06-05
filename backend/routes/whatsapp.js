const express = require("express");
const Client = require("../models/Client");
const CommunicationMessage = require("../models/CommunicationMessage");
const whatsappProvider = require("../services/whatsappProvider");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const toDateFromUnix = (value) => {
  const seconds = parseInt(value, 10);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
};

const getStatusErrorText = (status) =>
  (status.errors || [])
    .map((error) => error.title || error.message || error.details || error.code)
    .filter(Boolean)
    .join("; ");

const mapInboundMessage = (message) => {
  const type = message.type || "text";
  if (type === "text") {
    return {
      messageType: "text",
      body: message.text?.body || "",
    };
  }
  const media = message[type] || {};
  const isVoice = type === "audio" && media.voice;
  return {
    messageType: isVoice ? "voice" : type,
    body: media.caption || "",
    mediaId: media.id || "",
    mediaMimeType: media.mime_type || "",
    mediaSha256: media.sha256 || "",
    mediaFilename: media.filename || "",
    mediaCaption: media.caption || "",
  };
};

const saveInboundMessage = async ({ value, message }) => {
  const client = await Client.findClientByPhone(message.from);
  const mapped = mapInboundMessage(message);
  const saved = await CommunicationMessage.createMessage({
    clientId: client?.id || null,
    userId: null,
    channel: "WHATSAPP",
    direction: "INBOUND",
    status: "RECEIVED",
    fromNumber: message.from || "",
    toNumber:
      value.metadata?.display_phone_number ||
      value.metadata?.phone_number_id ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      "",
    provider: "meta",
    providerMessageId: message.id || "",
    rawPayload: message,
    ...mapped,
  });

  if (client) {
    await Client.addClientHistory({
      clientId: client.id,
      userId: null,
      action: "WHATSAPP_INBOUND_MESSAGE",
      newValue: saved,
      note: mapped.body || mapped.mediaFilename || mapped.messageType,
    });
  }

  return saved;
};

const updateDeliveryStatus = async (status) => {
  const normalized = String(status.status || "").toUpperCase();
  await CommunicationMessage.updateProviderStatus({
    providerMessageId: status.id,
    status: normalized || "STATUS",
    errorText: getStatusErrorText(status),
    deliveredAt: normalized === "DELIVERED" ? toDateFromUnix(status.timestamp) : null,
    readAt: normalized === "READ" ? toDateFromUnix(status.timestamp) : null,
    rawPayload: status,
  });
};

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const status of value.statuses || []) {
          await updateDeliveryStatus(status);
        }
        for (const message of value.messages || []) {
          await saveInboundMessage({ value, message });
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("[WhatsApp Webhook]", err);
    res.sendStatus(200);
  }
});

router.get("/media/:mediaId", verifyToken, async (req, res) => {
  try {
    const media = await whatsappProvider.downloadMedia(req.params.mediaId);
    const filename = String(media.filename || req.params.mediaId).replace(/"/g, "");
    res.setHeader("Content-Type", media.mimeType);
    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    res.send(media.buffer);
  } catch (err) {
    console.error("[WhatsApp Media]", err);
    res.status(502).json({ error: "WhatsApp media unavailable" });
  }
});

module.exports = router;
