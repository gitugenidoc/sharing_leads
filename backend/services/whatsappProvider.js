const https = require("https");

const API_BASE_URL = process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com";
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";

const getAccessToken = () => process.env.WHATSAPP_ACCESS_TOKEN || "";
const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";

const isConfigured = () => Boolean(getAccessToken() && getPhoneNumberId());

const normalizeWhatsappNumber = (phone) =>
  String(phone || "")
    .replace(/^00/, "")
    .replace(/[^\d]/g, "");

const graphUrl = (path) =>
  new URL(`${API_BASE_URL.replace(/\/$/, "")}/${API_VERSION}/${path.replace(/^\//, "")}`);

const readResponse = (res) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const contentType = res.headers["content-type"] || "";
      const payload = contentType.includes("application/json") && text ? JSON.parse(text) : text;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ payload, headers: res.headers });
        return;
      }
      const error = new Error(
        payload?.error?.message || payload?.message || `WhatsApp API error ${res.statusCode}`,
      );
      error.statusCode = res.statusCode;
      error.providerResponse = payload;
      reject(error);
    });
    res.on("error", reject);
  });

const requestJson = async (method, url, body = null) => {
  if (!getAccessToken()) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  }
  const data = body ? Buffer.from(JSON.stringify(body)) : null;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      ...(data
        ? {
            "Content-Type": "application/json",
            "Content-Length": data.length,
          }
        : {}),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, async (res) => {
      try {
        resolve(await readResponse(res));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
};

const requestBinary = async (url) => {
  if (!getAccessToken()) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  }
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ buffer, headers: res.headers });
            return;
          }
          const error = new Error(`WhatsApp media download error ${res.statusCode}`);
          error.providerResponse = buffer.toString("utf8");
          reject(error);
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
};

const sendMessage = async (payload) => {
  if (!isConfigured()) {
    throw new Error("WhatsApp Cloud API is not configured");
  }
  const url = graphUrl(`/${getPhoneNumberId()}/messages`);
  const response = await requestJson("POST", url, payload);
  return {
    status: "SENT",
    provider: "meta",
    providerMessageId: response.payload?.messages?.[0]?.id || "",
    rawPayload: response.payload,
  };
};

const sendTextMessage = async ({ to, body }) =>
  sendMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeWhatsappNumber(to),
    type: "text",
    text: {
      preview_url: false,
      body,
    },
  });

const buildMediaPayload = ({ to, type, mediaId, caption = "", filename = "" }) => {
  const normalizedType = type === "voice" ? "audio" : type;
  const media = { id: mediaId };
  if (["image", "video", "document"].includes(normalizedType) && caption) {
    media.caption = caption;
  }
  if (normalizedType === "document" && filename) {
    media.filename = filename;
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeWhatsappNumber(to),
    type: normalizedType,
    [normalizedType]: media,
  };
};

const sendMediaMessage = async ({ to, type, mediaId, caption = "", filename = "" }) =>
  sendMessage(buildMediaPayload({ to, type, mediaId, caption, filename }));

const uploadMedia = async ({ buffer, mimeType, filename }) => {
  if (!isConfigured()) {
    throw new Error("WhatsApp Cloud API is not configured");
  }
  const boundary = `wa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fields = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n`),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${String(filename || "file").replace(/"/g, "")}"\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
    ),
    Buffer.from(buffer),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(fields);
  const url = graphUrl(`/${getPhoneNumberId()}/media`);
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, async (res) => {
      try {
        const response = await readResponse(res);
        resolve(response.payload);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
};

const getMediaUrl = async (mediaId) => {
  const response = await requestJson("GET", graphUrl(`/${mediaId}`));
  return response.payload;
};

const downloadMedia = async (mediaId) => {
  const media = await getMediaUrl(mediaId);
  const downloaded = await requestBinary(new URL(media.url));
  return {
    buffer: downloaded.buffer,
    mimeType: media.mime_type || downloaded.headers["content-type"] || "application/octet-stream",
    filename: media.filename || `${mediaId}`,
    media,
  };
};

module.exports = {
  isConfigured,
  normalizeWhatsappNumber,
  sendTextMessage,
  sendMediaMessage,
  uploadMedia,
  getMediaUrl,
  downloadMedia,
};
