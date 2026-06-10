const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./activities.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listActivities));

module.exports = router;
