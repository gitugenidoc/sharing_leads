const express = require("express");
const XLSX = require("xlsx");
const Client = require("../models/Client");
const User = require("../models/User");
const Log = require("../models/Log");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  validateClient,
} = require("../middleware/validation-mutuelle");

const router = express.Router();
const MAX_IMPORT_ROWS = 5000;
const ALLOWED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ALLOWED_IMPORT_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream",
];

const isAllowedImportFile = (file) => {
  const name = file.name || "";
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  return (
    ALLOWED_IMPORT_EXTENSIONS.includes(extension) &&
    ALLOWED_IMPORT_MIME_TYPES.includes(file.mimetype)
  );
};

const isSuperAdmin = (user) => user.role === "SUPER_ADMIN";
const getAdminCenterId = (user) => (isSuperAdmin(user) ? null : user.center_id || -1);

const canAccessClient = (user, client) => {
  if (isSuperAdmin(user)) return true;
  if (user.role === "ADMIN") {
    return user.center_id && user.center_id === client.center_id;
  }
  return client.assigned_to === user.id;
};

const resolveCenterIdForWrite = (user, body = {}) => {
  if (user.role === "ADMIN") {
    return user.center_id;
  }
  if (isSuperAdmin(user)) {
    return parseInt(body.center_id || body.centerId, 10) || null;
  }
  return null;
};

const getAssignableAgent = async (user, userId) => {
  const agent = await User.getUserById(userId);
  if (!agent || agent.role !== "AGENT") {
    return null;
  }
  if (!isSuperAdmin(user) && agent.center_id !== user.center_id) {
    return null;
  }
  return agent;
};

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
    if (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN") {
      results = await Client.searchClients(
        q,
        parseInt(offset),
        parseInt(limit),
        getAdminCenterId(req.user),
      );
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
    if (!isAllowedImportFile(req.files.file)) {
      return res.status(400).json({
        error: "Only Excel or CSV files are accepted",
      });
    }

    const workbook = XLSX.read(req.files.file.data, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        error: `Import is limited to ${MAX_IMPORT_ROWS} rows`,
      });
    }
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

    const centerId = resolveCenterIdForWrite(req.user, req.body);
    if (!centerId) {
      return res.status(400).json({ error: "Center is required for import" });
    }

    if (clients.length > 0) {
      await Client.bulkInsertClients(clients, centerId);
    }

    await Log.createImportLog({
      adminId: req.user.id,
      filename: req.files.file.name,
      totalRows: rows.length,
      importedRows: clients.length,
      failedRows: errors.length,
    });

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

    const agent = await getAssignableAgent(req.user, userId);
    if (!agent) {
      return res.status(400).json({ error: "Assignable agent not found" });
    }

    const clients = await Client.assignRandomClients(
      userId,
      count,
      agent.center_id,
    );
    await Promise.all(
      clients.map((client) =>
        Log.createAuditLog({
          userId: req.user.id,
          action: "ASSIGN_RANDOM",
          entityType: "client",
          entityId: client.id,
          newValue: { assigned_to: userId },
        }),
      ),
    );
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
    const centerId = getAdminCenterId(req.user);
    const clients = await Client.getAllClients(offset, limit, centerId);
    const total = await Client.getClientsCount(centerId);

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
    if (!canAccessClient(req.user, client)) {
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

    const centerId = resolveCenterIdForWrite(req.user, req.body);
    if (!centerId) {
      return res.status(400).json({ error: "Center is required" });
    }

    const client = await Client.createClient({ ...req.body, center_id: centerId });
    await Log.createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "client",
      entityId: client.id,
      newValue: client,
    });
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
    if (!canAccessClient(req.user, client)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const validation = validateClient({ ...client, ...req.body });
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: validation.errors });
    }

    const updates = { ...req.body };
    delete updates.center_id;
    delete updates.centerId;
    if (updates.assigned_to) {
      const agent = await getAssignableAgent(req.user, updates.assigned_to);
      if (!agent || agent.center_id !== client.center_id) {
        return res.status(400).json({ error: "Assignable agent not found" });
      }
    }
    const updatedClient = await Client.updateClient(req.params.id, updates);
    await Log.createAuditLog({
      userId: req.user.id,
      action: "UPDATE",
      entityType: "client",
      entityId: updatedClient.id,
      oldValue: client,
      newValue: updatedClient,
    });
    res.json(updatedClient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const client = await Client.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    if (!canAccessClient(req.user, client)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await Client.deleteClient(req.params.id);
    await Log.createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "client",
      entityId: client.id,
      oldValue: client,
    });
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

    const existingClient = await Client.getClientById(req.params.id);
    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }
    if (!canAccessClient(req.user, existingClient)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const agent = await getAssignableAgent(req.user, userId);
    if (!agent || agent.center_id !== existingClient.center_id) {
      return res.status(400).json({ error: "Assignable agent not found" });
    }

    const client = await Client.assignClient(req.params.id, userId);
    await Log.createAuditLog({
      userId: req.user.id,
      action: "ASSIGN",
      entityType: "client",
      entityId: client.id,
      newValue: { assigned_to: userId },
    });
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
