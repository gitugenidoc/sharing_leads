const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./visits.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listVisits));
router.post("/", asyncHandler(controller.createVisit));
router.post("/:visitId/check-in", asyncHandler(controller.checkIn));
router.post("/:visitId/check-out", asyncHandler(controller.checkOut));

module.exports = router;
