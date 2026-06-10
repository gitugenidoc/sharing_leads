const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./leads.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listLeads));
router.post("/", asyncHandler(controller.createLead));
router.get("/:leadId", asyncHandler(controller.getLead));
router.patch("/:leadId/status", asyncHandler(controller.updateStatus));

module.exports = router;
