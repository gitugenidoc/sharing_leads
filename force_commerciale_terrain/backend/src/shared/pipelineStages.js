const PIPELINE_STAGES = [
  "NOUVEAU_LEAD",
  "QUALIFICATION",
  "PREMIER_CONTACT",
  "ANALYSE_DU_BESOIN",
  "OPPORTUNITE",
  "PROPOSITION",
  "NEGOTIATION",
  "GAGNE",
  "PERDU",
  "ONBOARDING",
  "FIDELISATION",
];

const PIPELINE_STAGE_ALIASES = {
  NEW: "NOUVEAU_LEAD",
  CONTACTED: "PREMIER_CONTACT",
  QUALIFIED: "QUALIFICATION",
  VISIT_PLANNED: "ANALYSE_DU_BESOIN",
  PROPOSAL_SENT: "PROPOSITION",
  WON: "GAGNE",
  LOST: "PERDU",
};

function normalizeValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function normalizePipelineStage(value) {
  const normalized = normalizeValue(value);
  return PIPELINE_STAGE_ALIASES[normalized] || normalized;
}

function getPipelineStageRank(stage) {
  const normalized = normalizePipelineStage(stage);
  const index = PIPELINE_STAGES.indexOf(normalized);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

module.exports = {
  PIPELINE_STAGES,
  normalizePipelineStage,
  getPipelineStageRank,
};
