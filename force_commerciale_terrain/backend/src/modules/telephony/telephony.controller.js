const env = require("../../config/env");
const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const { getScopedAgentId } = require("../../shared/scope");
const telephonyService = require("./telephony.service");

async function createCampaignCall(req, res) {
  if (!req.body.phoneNumber && !req.body.leadId) {
    throw new HttpError(400, "leadId or phoneNumber is required");
  }

  const result = await telephonyService.dispatchCampaignCall({
    leadId: req.body.leadId,
    phoneNumber: req.body.phoneNumber,
    agentId: req.body.agentId || req.user.id,
    campaignId: req.body.campaignId,
  });

  return sendSuccess(res, result, 201);
}

async function listEvents(req, res) {
  const agentId = getScopedAgentId(req.user, req.query.agentId);
  const events = await prisma.callEvent.findMany({
    where: {
      ...(req.query.leadId ? { leadId: req.query.leadId } : {}),
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { happenedAt: "desc" },
  });

  return sendSuccess(res, events);
}

async function snaptelWebhook(req, res) {
  if (
    env.snaptelWebhookSecret &&
    req.header(env.snaptelWebhookSecretHeader) !== env.snaptelWebhookSecret
  ) {
    throw new HttpError(401, "Invalid Snaptel webhook secret");
  }

  const result = await telephonyService.handleSnaptelWebhook(req.body);
  return sendSuccess(res, result);
}

module.exports = {
  createCampaignCall,
  listEvents,
  snaptelWebhook,
};
