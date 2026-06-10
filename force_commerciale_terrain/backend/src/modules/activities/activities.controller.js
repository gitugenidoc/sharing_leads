const prisma = require("../../lib/prisma");
const { sendSuccess } = require("../../shared/apiResponse");
const { getScopedAgentId } = require("../../shared/scope");

async function listActivities(req, res) {
  const agentId = getScopedAgentId(req.user, req.query.agentId);
  const activities = await prisma.activity.findMany({
    where: {
      ...(req.query.leadId ? { leadId: req.query.leadId } : {}),
      ...(agentId ? { agentId } : {}),
      ...(req.query.type ? { type: req.query.type.toUpperCase() } : {}),
    },
    include: {
      lead: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  return sendSuccess(res, activities);
}

module.exports = {
  listActivities,
};
