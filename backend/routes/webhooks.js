const express = require("express");
const { processSnaptelCallEvent } = require("../services/snaptelWebhookService");

const router = express.Router();

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const extractWebhookSecret = (req) =>
  toText(
    req.headers["x-snaptel-secret"] ||
      req.headers["x-webhook-secret"] ||
      (toText(req.headers.authorization).toLowerCase().startsWith("bearer ")
        ? req.headers.authorization.slice(7).trim()
        : ""),
  );

router.post("/snaptel/call-event", async (req, res) => {
  const providedSecret = extractWebhookSecret(req);
  const centerIdHint = req.query.center_id
    ? parseInt(req.query.center_id, 10)
    : null;

  try {
    const result = await processSnaptelCallEvent({
      payload: req.body || {},
      providedSecret,
      centerIdHint: Number.isFinite(centerIdHint) ? centerIdHint : null,
      isTest: Boolean(req.body?.is_test),
      legacyMode: false,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[Snaptel Webhook]", err);
    return res.status(500).json({ error: "snaptel_webhook_processing_failed" });
  }
});

module.exports = router;
