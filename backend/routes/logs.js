const express = require("express");
const Log = require("../models/Log");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

const getPagination = (query) => {
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const requestedLimit = parseInt(query.limit, 10) || 100;
  const limit = Math.min(Math.max(requestedLimit, 1), 500);
  return { offset, limit };
};

const getCenterScope = (user) =>
  user.role === "SUPER_ADMIN" ? null : user.center_id;

router.get("/imports", verifyToken, isAdmin, async (req, res) => {
  try {
    const { offset, limit } = getPagination(req.query);
    const centerId = getCenterScope(req.user);
    const [logs, total] = await Promise.all([
      Log.getImportLogs(offset, limit, centerId),
      Log.getImportLogsCount(centerId),
    ]);
    res.json({ logs, total, offset, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/audit", verifyToken, isAdmin, async (req, res) => {
  try {
    const { offset, limit } = getPagination(req.query);
    const centerId = getCenterScope(req.user);
    const [logs, total] = await Promise.all([
      Log.getAuditLogs(offset, limit, centerId),
      Log.getAuditLogsCount(centerId),
    ]);
    res.json({ logs, total, offset, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
