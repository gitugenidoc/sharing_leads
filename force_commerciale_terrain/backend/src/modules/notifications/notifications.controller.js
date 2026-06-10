const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");

async function listNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, notifications);
}

async function markAsRead(req, res) {
  const existingNotification = await prisma.notification.findUnique({
    where: { id: req.params.notificationId },
  });

  if (!existingNotification) {
    throw new HttpError(404, "Notification not found");
  }

  const notification = await prisma.notification.update({
    where: { id: req.params.notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return sendSuccess(res, notification);
}

module.exports = {
  listNotifications,
  markAsRead,
};
