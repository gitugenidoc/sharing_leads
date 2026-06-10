const express = require("express");

const auth = require("../../middlewares/auth");
const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./auth.controller");

const router = express.Router();

router.post("/bootstrap", asyncHandler(controller.bootstrap));
router.post("/login", asyncHandler(controller.login));
router.get("/me", auth, asyncHandler(controller.me));

module.exports = router;
