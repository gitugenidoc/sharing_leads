const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const telephonyPublicRoutes = require("../modules/telephony/telephony.public.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/telephony", telephonyPublicRoutes);

module.exports = router;
