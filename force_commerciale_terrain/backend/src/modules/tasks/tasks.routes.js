const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./tasks.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listTasks));
router.post("/", asyncHandler(controller.createTask));
router.patch("/:taskId/status", asyncHandler(controller.updateTaskStatus));

module.exports = router;
