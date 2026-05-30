const express = require("express");
const Lead = require("../models/Lead");
const { verifyToken, isAdmin } = require("../middleware/auth");
const XLSX = require("xlsx");

const router = express.Router();

// Search leads (must come before /:id route)
router.get("/search", verifyToken, async (req, res) => {
  try {
    const { q, offset = 0, limit = 100 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }

    let results;
    if (req.user.role === "ADMIN") {
      results = await Lead.searchLeads(q, parseInt(offset), parseInt(limit));
    } else {
      // For agents, search only in their assigned leads
      results = (await Lead.getUserLeads(req.user.id, 0, 999999))
        .filter(
          (lead) =>
            lead.name.toLowerCase().includes(q.toLowerCase()) ||
            lead.email.toLowerCase().includes(q.toLowerCase()) ||
            lead.phone.includes(q),
        )
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }

    res.json({ results, query: q });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user's assigned leads
router.get("/me", verifyToken, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 100;

    const leads = await Lead.getUserLeads(req.user.id, offset, limit);
    const total = await Lead.getUserLeadsCount(req.user.id);

    res.json({
      leads,
      total,
      offset,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Import leads from Excel (admin only)
router.post("/import", verifyToken, isAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "File required" });
    }

    const file = req.files.file;
    const workbook = XLSX.read(file.data, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Validate and clean data
    const leads = data
      .map((row) => ({
        name: row.name || row.Name || "",
        email: row.email || row.Email || "",
        phone: row.phone || row.Phone || "",
        status: row.status || row.Status || "NEW",
        source: row.source || row.Source || "IMPORT",
        amount: parseFloat(row.amount) || parseFloat(row.Amount) || 0,
        notes: row.notes || row.Notes || "",
      }))
      .filter((lead) => lead.name || lead.email); // Filter out empty rows

    await Lead.bulkInsertLeads(leads);

    res.json({
      message: `${leads.length} leads imported successfully`,
      count: leads.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all leads (admin only) with pagination
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 100;

    const leads = await Lead.getAllLeads(offset, limit);
    const total = await Lead.getLeadsCount();

    res.json({
      leads,
      total,
      offset,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get lead by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const lead = await Lead.getLeadById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Check permissions: must be admin or assigned to this lead
    if (req.user.role !== "ADMIN" && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create lead (admin only)
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const lead = await Lead.createLead(req.body);
    res.status(201).json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update lead
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const lead = await Lead.getLeadById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Check permissions: must be admin or assigned to this lead
    if (req.user.role !== "ADMIN" && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updatedLead = await Lead.updateLead(req.params.id, req.body);
    res.json(updatedLead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete lead (admin only)
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await Lead.deleteLead(req.params.id);
    res.json({ message: "Lead deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Assign lead to user (admin only)
router.put("/:id/assign", verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const lead = await Lead.assignLead(req.params.id, userId);
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
