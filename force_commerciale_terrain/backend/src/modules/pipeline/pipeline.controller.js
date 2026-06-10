const prisma = require("../../lib/prisma");
const { sendSuccess } = require("../../shared/apiResponse");
const {
  PIPELINE_STAGES,
  getPipelineStageRank,
} = require("../../shared/pipelineStages");
const { getScopedAgentId } = require("../../shared/scope");

async function getSummary(req, res) {
  const assignedAgentId = getScopedAgentId(req.user, req.query.assignedAgentId);
  const leads = await prisma.lead.findMany({
    where: assignedAgentId ? { assignedAgentId } : {},
    orderBy: { createdAt: "desc" },
  });

  const summaryMap = new Map(
    PIPELINE_STAGES.map((stage) => [
      stage,
      {
        stage,
        count: 0,
        annualPotential: 0,
      },
    ])
  );

  for (const lead of leads) {
    const key = lead.stage;
    const current = summaryMap.get(key) || {
      stage: key,
      count: 0,
      annualPotential: 0,
    };
    current.count += 1;
    current.annualPotential += Number(lead.annualPotential || 0);
    summaryMap.set(key, current);
  }

  return sendSuccess(
    res,
    Array.from(summaryMap.values()).sort(
      (left, right) => getPipelineStageRank(left.stage) - getPipelineStageRank(right.stage)
    )
  );
}

module.exports = {
  getSummary,
};
