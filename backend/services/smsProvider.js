const https = require("https");

const postForm = (url, body, { username, password }) =>
  new Promise((resolve, reject) => {
    const endpoint = new URL(url);
    const payload = new URLSearchParams(body).toString();
    const request = https.request(
      {
        method: "POST",
        hostname: endpoint.hostname,
        path: `${endpoint.pathname}${endpoint.search}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let parsed = {};
          try {
            parsed = JSON.parse(data || "{}");
          } catch (err) {
            parsed = { raw: data };
          }
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }
          const error = new Error(parsed.message || "SMS provider error");
          error.providerResponse = parsed;
          reject(error);
        });
      },
    );
    request.on("error", reject);
    request.write(payload);
    request.end();
  });

const sendTwilioSms = async ({ from, to, body }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken || !from) {
    return {
      status: "PREPARED",
      provider: "twilio",
      providerMessageId: "",
      rawPayload: { reason: "Twilio credentials or sender missing" },
    };
  }

  const response = await postForm(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      From: from,
      To: to,
      Body: body,
    },
    { username: accountSid, password: authToken },
  );

  return {
    status: response.status ? String(response.status).toUpperCase() : "SENT",
    provider: "twilio",
    providerMessageId: response.sid || "",
    rawPayload: response,
  };
};

const sendSms = async ({ from, to, body }) => {
  if (process.env.SMS_SEND_MODE !== "provider") {
    return {
      status: "PREPARED",
      provider: process.env.SMS_PROVIDER || "manual",
      providerMessageId: "",
      rawPayload: { reason: "SMS_SEND_MODE is not provider" },
    };
  }

  if ((process.env.SMS_PROVIDER || "twilio").toLowerCase() === "twilio") {
    return sendTwilioSms({ from, to, body });
  }

  return {
    status: "PREPARED",
    provider: process.env.SMS_PROVIDER || "manual",
    providerMessageId: "",
    rawPayload: { reason: "Unsupported SMS provider" },
  };
};

module.exports = {
  sendSms,
};
