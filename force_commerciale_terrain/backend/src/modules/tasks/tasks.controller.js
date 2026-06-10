const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const { getScopedAgentId } = require("../../shared/scope");

function normalizeTaskStatus(value) {
  return value ? value.toUpperCase().replace(/ /g, "_") : undefined;
}

async function listTasks(req, res) {
  const ownerId = getScopedAgentId(req.user, req.query.ownerId);
  const tasks = await prisma.task.findMany({
    where: {
      ...(ownerId ? { ownerId } : {}),
      ...(req.query.leadId ? { leadId: req.query.leadId } : {}),
      ...(req.query.status ? { status: normalizeTaskStatus(req.query.status) } : {}),
    },
    orderBy: { dueAt: "asc" },
  });

  return sendSuccess(res, tasks);
}

async function createTask(req, res) {
  const task = await prisma.task.create({
    data: {
      leadId: req.body.leadId || null,
      ownerId: req.body.ownerId || req.user.id,
      title: req.body.title,
      description: req.body.description || null,
      type: req.body.type ? req.body.type.toUpperCase() : "FOLLOW_UP",
      dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
    },
  });

  await prisma.activity.create({
    data: {
      type: "TASK",
      leadId: task.leadId,
      agentId: task.ownerId,
      title: task.title,
      description: task.description,
      occurredAt: new Date(),
    },
  });

  return sendSuccess(res, task, 201);
}

async function updateTaskStatus(req, res) {
  const existingTask = await prisma.task.findUnique({
    where: { id: req.params.taskId },
  });

  if (!existingTask) {
    throw new HttpError(404, "Task not found");
  }

  const status = normalizeTaskStatus(req.body.status);
  const task = await prisma.task.update({
    where: { id: req.params.taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  return sendSuccess(res, task);
}

module.exports = {
  listTasks,
  createTask,
  updateTaskStatus,
};
