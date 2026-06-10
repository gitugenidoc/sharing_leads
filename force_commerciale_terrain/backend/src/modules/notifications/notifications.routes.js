const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./notifications.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listNotifications));
router.post("/:notificationId/read", asyncHandler(controller.markAsRead));

module.exports = router;
