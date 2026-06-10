const prisma = require("../../lib/prisma");
const { sendSuccess } = require("../../shared/apiResponse");
const { normalizePipelineStage } = require("../../shared/pipelineStages");
const { getScopedAgentId } = require("../../shared/scope");

async function getSummary(req, res) {
  const assignedAgentId = getScopedAgentId(req.user, req.query.assignedAgentId);
  const leadWhere = assignedAgentId ? { assignedAgentId } : {};
  const taskWhere = assignedAgentId ? { ownerId: assignedAgentId } : {};
  const visitWhere = assignedAgentId ? { agentId: assignedAgentId } : {};
  const activityWhere = assignedAgentId ? { agentId: assignedAgentId } : {};

  const [leads, tasks, visits, activities] = await Promise.all([
    prisma.lead.findMany({ where: leadWhere }),
    prisma.task.findMany({
      where: taskWhere,
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.visit.findMany({
      where: visitWhere,
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.activity.findMany({
      where: activityWhere,
      include: { lead: true },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
  ]);

  const leadStatuses = leads.reduce((acc, lead) => {
    const key = normalizePipelineStage(lead.stage || lead.status).toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const currentAnnualIncome = leads
    .filter((lead) => normalizePipelineStage(lead.stage || lead.status) === "GAGNE")
    .reduce((sum, lead) => sum + Number(lead.annualPotential || 0), 0);

  return sendSuccess(res, {
    cards: [
      {
        id: "income",
        label: "Current Annual Income",
        value: currentAnnualIncome,
        trend: 0,
        unit: "MAD",
      },
      {
        id: "leads",
        label: "Assigned Leads",
        value: leads.length,
      },
      {
        id: "tasks",
        label: "Open Tasks",
        value: tasks.filter((task) => task.status !== "DONE").length,
      },
      {
        id: "visits",
        label: "Planned Visits",
        value: visits.filter((visit) => visit.status === "PLANNED").length,
      },
    ],
    leadStatuses,
    tasks,
    visits,
    activities,
  });
}

module.exports = {
  getSummary,
};
