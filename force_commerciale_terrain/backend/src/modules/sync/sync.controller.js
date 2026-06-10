const prisma = require("../../lib/prisma");
const { sendSuccess } = require("../../shared/apiResponse");

async function bootstrap(req, res) {
  const leadWhere = req.user.role === "AGENT" ? { assignedAgentId: req.user.id } : {};
  const taskWhere = req.user.role === "AGENT" ? { ownerId: req.user.id } : {};

  const [leads, tasks, notifications] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: taskWhere,
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return sendSuccess(res, {
    user: req.user,
    dashboard: {
      leadsCount: leads.length,
      tasksCount: tasks.length,
      notificationsCount: notifications.filter((notification) => !notification.isRead).length,
    },
    leads,
    tasks,
    notifications,
  });
}

module.exports = {
  bootstrap,
};
