const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const {
  normalizePipelineStage,
} = require("../../shared/pipelineStages");
const { getScopedAgentId } = require("../../shared/scope");

function normalizeEnumValue(value) {
  return value
    ? String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
        .toUpperCase()
    : undefined;
}

async function listLeads(req, res) {
  const scopedAgentId = getScopedAgentId(req.user, req.query.assignedAgentId);
  const search = req.query.search?.trim();

  const leads = await prisma.lead.findMany({
    where: {
      ...(scopedAgentId ? { assignedAgentId: scopedAgentId } : {}),
      ...(req.query.status ? { status: normalizeEnumValue(req.query.status) } : {}),
      ...(req.query.stage ? { stage: normalizePipelineStage(req.query.stage) } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { phoneNumber: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, leads);
}

async function getLead(req, res) {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.leadId },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
      visits: { orderBy: { scheduledAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" } },
      callEvents: { orderBy: { happenedAt: "desc" } },
    },
  });

  if (!lead) {
    throw new HttpError(404, "Lead not found");
  }

  return sendSuccess(res, lead);
}

async function createLead(req, res) {
  const lead = await prisma.lead.create({
    data: {
      fullName: req.body.fullName,
      phoneNumber: req.body.phoneNumber,
      email: req.body.email || null,
      companyName: req.body.companyName || null,
      address: req.body.address || null,
      city: req.body.city || null,
      sector: req.body.sector || null,
      source: req.body.source || "manual",
      status: "NEW",
      stage: "NOUVEAU_LEAD",
      score: Number(req.body.score || 0),
      annualPotential: Number(req.body.annualPotential || 0),
      notesSummary: req.body.notesSummary || null,
      nextActionAt: req.body.nextActionAt ? new Date(req.body.nextActionAt) : null,
      assignedAgentId: req.body.assignedAgentId || req.user.id,
    },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE",
      leadId: lead.id,
      agentId: req.user.id,
      title: "Lead created",
      description: "Lead created from mobile or backoffice.",
      occurredAt: new Date(),
    },
  });

  return sendSuccess(res, lead, 201);
}

async function updateStatus(req, res) {
  const existingLead = await prisma.lead.findUnique({
    where: { id: req.params.leadId },
  });

  if (!existingLead) {
    throw new HttpError(404, "Lead not found");
  }

  const lead = await prisma.lead.update({
    where: { id: req.params.leadId },
    data: {
      status: req.body.status ? normalizeEnumValue(req.body.status) : undefined,
      stage: req.body.stage ? normalizePipelineStage(req.body.stage) : undefined,
      lastContactAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      type: "STATUS_CHANGE",
      leadId: lead.id,
      agentId: req.user.id,
      title: `Lead status updated to ${lead.status}`,
      description: `Pipeline stage is now ${lead.stage}.`,
      occurredAt: new Date(),
    },
  });

  return sendSuccess(res, lead);
}

module.exports = {
  listLeads,
  getLead,
  createLead,
  updateStatus,
};
