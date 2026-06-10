const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4100),
  appName: process.env.APP_NAME || "ForceCommercialeTerrain",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4100",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  snaptelWebhookSecret: process.env.SNAPTEL_WEBHOOK_SECRET || "",
  snaptelWebhookSecretHeader:
    process.env.SNAPTEL_WEBHOOK_SECRET_HEADER || "x-snaptel-secret",
  snaptelCampaignWebhookUrl: process.env.SNAPTEL_CAMPAIGN_WEBHOOK_URL || "",
  snaptelCampaignWebhookSecret: process.env.SNAPTEL_CAMPAIGN_WEBHOOK_SECRET || "",
  snaptelCampaignWebhookSecretHeader:
    process.env.SNAPTEL_CAMPAIGN_WEBHOOK_SECRET_HEADER || "x-snaptel-secret",
};
