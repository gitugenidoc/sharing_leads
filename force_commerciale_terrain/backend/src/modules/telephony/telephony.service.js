const env = require("../../config/env");
const prisma = require("../../lib/prisma");

function normalizeDirection(value) {
  return value ? value.toUpperCase() : "INBOUND";
}

function normalizeProviderStatus(payload) {
  return String(payload.event || payload.status || "ringing")
    .replace(/\./g, "_")
    .replace(/ /g, "_")
    .toUpperCase();
}

async function dispatchCampaignCall(payload) {
  const lead = payload.leadId
    ? await prisma.lead.findUnique({ where: { id: payload.leadId } })
    : null;
  const phoneNumber = payload.phoneNumber || lead?.phoneNumber;

  if (!phoneNumber) {
    throw new Error("No phone number available for outbound call");
  }

  const callEvent = await prisma.callEvent.create({
    data: {
      leadId: lead?.id || null,
      agentId: payload.agentId,
      direction: "OUTBOUND",
      phoneNumber,
      campaignId: payload.campaignId || null,
      provider: "snaptel",
      status: "QUEUED",
      happenedAt: new Date(),
      rawPayload: JSON.stringify(payload),
    },
  });

  await prisma.activity.create({
    data: {
      type: "CALL",
      leadId: lead?.id || null,
      agentId: payload.agentId,
      title: "Outbound call requested",
      description: `Campaign ${payload.campaignId || "default"} queued for ${phoneNumber}.`,
      occurredAt: new Date(),
    },
  });

  let providerResponse = null;
  let dispatched = false;

  if (env.snaptelCampaignWebhookUrl) {
    const headers = {
      "content-type": "application/json",
    };
    if (env.snaptelCampaignWebhookSecret) {
      headers[env.snaptelCampaignWebhookSecretHeader] =
        env.snaptelCampaignWebhookSecret;
    }

    const response = await fetch(env.snaptelCampaignWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        leadId: lead?.id || null,
        phoneNumber,
        agentId: payload.agentId,
        campaignId: payload.campaignId || null,
      }),
    });

    dispatched = response.ok;
    providerResponse = await response.text();

    await prisma.callEvent.update({
      where: { id: callEvent.id },
      data: {
        status: response.ok ? "DISPATCHED" : "FAILED",
      },
    });
  }

  return {
    callEventId: callEvent.id,
    dispatched,
    providerResponse,
  };
}

async function handleSnaptelWebhook(payload) {
  const lead = await prisma.lead.findUnique({
    where: { phoneNumber: payload.phoneNumber },
  });
  const agentId = payload.agentExternalId || lead?.assignedAgentId || null;

  const callEvent = await prisma.callEvent.create({
    data: {
      leadId: lead?.id || null,
      agentId,
      direction: normalizeDirection(payload.direction),
      phoneNumber: payload.phoneNumber,
      campaignId: payload.campaignId || null,
      provider: "snaptel",
      providerCallId: payload.providerCallId || null,
      status: normalizeProviderStatus(payload),
      happenedAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      rawPayload: JSON.stringify(payload),
    },
  });

  if (agentId) {
    await prisma.notification.create({
      data: {
        userId: agentId,
        title: "Appel detecte",
        body: lead
          ? `${lead.fullName} est associe a cet appel.`
          : `Numero ${payload.phoneNumber} sans lead associe.`,
        type: "incoming_call",
        payload: JSON.stringify({
          leadId: lead?.id || null,
          callEventId: callEvent.id,
        }),
      },
    });

    await prisma.activity.create({
      data: {
        type: "CALL",
        leadId: lead?.id || null,
        agentId,
        title: normalizeProviderStatus(payload),
        description: `Provider event received for ${payload.phoneNumber}.`,
        occurredAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      },
    });
  }

  return {
    matched: Boolean(lead),
    leadId: lead?.id || null,
    agentId,
    callEventId: callEvent.id,
  };
}

module.exports = {
  dispatchCampaignCall,
  handleSnaptelWebhook,
};
