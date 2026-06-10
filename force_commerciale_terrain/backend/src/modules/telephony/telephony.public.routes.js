const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./telephony.controller");

const router = express.Router();

router.post("/webhooks/snaptel", asyncHandler(controller.snaptelWebhook));

module.exports = router;
