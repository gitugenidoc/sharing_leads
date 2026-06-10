const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./dashboard.controller");

const router = express.Router();

router.get("/summary", asyncHandler(controller.getSummary));

module.exports = router;
