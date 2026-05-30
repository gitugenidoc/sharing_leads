const express = require("express");
const XLSX = require("xlsx");
const Client = require("../models/Client");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  validateClient,
  validateStatus,
} = require("../middleware/validation-mutuelle");

const router = express.Router();

const mapExcelRowToClient = (row) => ({
  nom: row.nom || row.Nom || "",
  prenom: row.prenom || row.Prenom || "",
  adresse: row.adresse || row.Adresse || "",
  ville: row.ville || row.Ville || "",
  code_postal: String(
    row.code_postal || row["Code postal"] || row.CodePostal || "",
  ),
  nom_mutuelle: row.nom_mutuelle || row["Nom mutuelle"] || row.Mutuelle || "",
  prix_mutuelle:
    parseFloat(row.prix_mutuelle || row["Prix mutuelle"] || row.Prix || 0) ||
    0,
  status: row.status || row.Status || "NEW",
  notes: row.notes || row.Notes || "",
});

router.get("/search", verifyToken, async (req, res) => {
  try {
    const { q, offset = 0, limit = 100 } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }

    let results;
    if (req.user.role === "ADMIN") {
      results = await Client.searchClients(q, parseInt(offset), parseInt(limit));
    } else {
      const query = q.toLowerCase();
      results = (await Client.getUserClients(req.user.id, 0, 999999))
        .filter(
          (client) =>
            client.nom.toLowerCase().includes(query) ||
            client.prenom.toLowerCase().includes(query) ||
            client.ville.toLowerCase().includes(query) ||
            client.code_postal.includes(query) ||
            client.nom_mutuelle.toLowerCase().includes(query),
        )
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }

    res.json({ results, query: q });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const clients = await Client.getUserClients(req.user.id, offset, limit);
    const total = await Client.getUserClientsCount(req.user.id);

    res.json({ clients, total, offset, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/import", verifyToken, isAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "File required" });
    }

    const workbook = XLSX.read(req.files.file.data, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    const clients = [];
    const errors = [];

    rows.forEach((row, index) => {
      const client = mapExcelRowToClient(row);
      const validation = validateClient(client);
      if (!validation.isValid) {
        errors.push({ row: index + 2, message: validation.errors.join("; ") });
        return;
      }
      clients.push(client);
    });

    if (clients.length > 0) {
      await Client.bulkInsertClients(clients);
    }

    res.json({
      message: `${clients.length} clients imported successfully`,
      imported: clients.length,
      total: rows.length,
      errors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/assign-random", verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.body.userId, 10);
    const count = parseInt(req.body.count, 10);

    if (!userId || !count || count < 1) {
      return res.status(400).json({
        error: "User ID and a positive count are required",
      });
    }

    const clients = await Client.assignRandomClients(userId, count);
    res.json({
      assigned: clients.length,
      requested: count,
      clients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const clients = await Client.getAllClients(offset, limit);
    const total = await Client.getClientsCount();

    res.json({ clients, total, offset, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const client = await Client.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    if (req.user.role !== "ADMIN" && client.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const validation = validateClient(req.body);
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: validation.errors });
    }

    const client = await Client.createClient(req.body);
    res.status(201).json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const client = await Client.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    if (req.user.role !== "ADMIN" && client.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (req.body.status && !validateStatus(req.body.status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedClient = await Client.updateClient(req.params.id, req.body);
    res.json(updatedClient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await Client.deleteClient(req.params.id);
    res.json({ message: "Client deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id/assign", verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const client = await Client.assignClient(req.params.id, userId);
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
