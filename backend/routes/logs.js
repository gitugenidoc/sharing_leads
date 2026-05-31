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

router.get("/imports", verifyToken, isAdmin, async (req, res) => {
  try {
    const { offset, limit } = getPagination(req.query);
    const [logs, total] = await Promise.all([
      Log.getImportLogs(offset, limit),
      Log.getImportLogsCount(),
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
    const [logs, total] = await Promise.all([
      Log.getAuditLogs(offset, limit),
      Log.getAuditLogsCount(),
    ]);
    res.json({ logs, total, offset, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
