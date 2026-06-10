const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const { getScopedAgentId } = require("../../shared/scope");

async function listVisits(req, res) {
  const agentId = getScopedAgentId(req.user, req.query.agentId);
  const visits = await prisma.visit.findMany({
    where: {
      ...(agentId ? { agentId } : {}),
      ...(req.query.leadId ? { leadId: req.query.leadId } : {}),
    },
    orderBy: { scheduledAt: "asc" },
  });

  return sendSuccess(res, visits);
}

async function createVisit(req, res) {
  const visit = await prisma.visit.create({
    data: {
      leadId: req.body.leadId,
      agentId: req.body.agentId || req.user.id,
      address: req.body.address || null,
      scheduledAt: new Date(req.body.scheduledAt),
    },
  });

  await prisma.activity.create({
    data: {
      type: "VISIT",
      leadId: visit.leadId,
      agentId: visit.agentId,
      title: "Visit scheduled",
      description: `Visit scheduled at ${visit.scheduledAt.toISOString()}.`,
      occurredAt: new Date(),
    },
  });

  return sendSuccess(res, visit, 201);
}

async function checkIn(req, res) {
  const existingVisit = await prisma.visit.findUnique({
    where: { id: req.params.visitId },
  });

  if (!existingVisit) {
    throw new HttpError(404, "Visit not found");
  }

  const visit = await prisma.visit.update({
    where: { id: req.params.visitId },
    data: {
      checkInAt: new Date(),
      latitude: req.body.latitude != null ? Number(req.body.latitude) : null,
      longitude: req.body.longitude != null ? Number(req.body.longitude) : null,
      status: "CHECKED_IN",
    },
  });

  return sendSuccess(res, visit);
}

async function checkOut(req, res) {
  const existingVisit = await prisma.visit.findUnique({
    where: { id: req.params.visitId },
  });

  if (!existingVisit) {
    throw new HttpError(404, "Visit not found");
  }

  const visit = await prisma.visit.update({
    where: { id: req.params.visitId },
    data: {
      checkOutAt: new Date(),
      summary: req.body.summary || null,
      status: "COMPLETED",
    },
  });

  return sendSuccess(res, visit);
}

module.exports = {
  listVisits,
  createVisit,
  checkIn,
  checkOut,
};
