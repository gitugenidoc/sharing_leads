const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./sync.controller");

const router = express.Router();

router.get("/bootstrap", asyncHandler(controller.bootstrap));

module.exports = router;
