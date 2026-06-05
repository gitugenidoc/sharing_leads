const express = require("express");
const { releaseExpiredAssignments } = require("../models/Client");

const router = express.Router();

const isCronAuthorized = (req) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${expected}`;
};

router.get("/release-expired-assignments", async (req, res) => {
  try {
    if (!isCronAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await releaseExpiredAssignments({ silent: true });
    res.json({
      status: "ok",
      released: result.released,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[Cron] release-expired-assignments failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
