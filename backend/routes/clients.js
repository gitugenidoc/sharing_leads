const express = require("express");
const XLSX = require("xlsx");
const Client = require("../models/Client");
const User = require("../models/User");
const Log = require("../models/Log");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { validateClient } = require("../middleware/validation-mutuelle");

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
const getAdminCenterId = (user) =>
  isSuperAdmin(user) ? null : user.center_id || -1;

const canAccessClient = (user, client) => {
  if (isSuperAdmin(user)) return true;
  if (user.role === "ADMIN") {
    return user.center_id && user.center_id === client.center_id;
  }
  return client.assigned_to === user.id;
};

const resolveCenterIdForWrite = (user, body = {}) => {
  if (user.role === "ADMIN") return user.center_id;
  if (isSuperAdmin(user)) {
    return parseInt(body.center_id || body.centerId, 10) || null;
  }
  return null;
};

const getAssignableAgent = async (user, userId) => {
  const agent = await User.getUserById(userId);
  if (!agent || agent.role !== "AGENT") return null;
  if (!isSuperAdmin(user) && agent.center_id !== user.center_id) return null;
  return agent;
};

const normalizeHeader = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const FIELD_ALIASES = {
  civilite: ["civilite", "civility", "title", "sexe"],
  nom: ["nom", "lastname", "surname", "familyname"],
  prenom: ["prenom", "firstname", "givenname", "forename"],
  profession: ["profession", "job", "occupation", "metier"],
  adresse: ["adresse", "address", "address1", "street"],
  adresse2: ["adresse2", "address2", "complementadresse"],
  ville: ["ville", "city", "commune", "localite"],
  code_postal: ["codepostal", "zipcode", "zip", "postalcode", "cp"],
  tel_fixe: ["telfixe", "telephonefixe", "phone", "landline"],
  tel_gsm: [
    "telgsm",
    "gsm",
    "mobile",
    "portable",
    "portablephonenumber",
    "mobilephone",
    "cellphone",
  ],
  email: ["email", "emailaddress", "mail", "courriel"],
  tel_professionnel: ["telprofessionnel", "workphone", "businessphone"],
  date_naissance: ["datenaissance", "birthdate", "dateofbirth", "dob"],
  date_naissance_conjoint: ["datenaissanceconjoint", "conjointbirthdate"],
  naissance_enfant_1: ["datenaissance1erenfant", "child1birthdate"],
  naissance_enfant_2: ["datenaissance2meenfant", "child2birthdate"],
  naissance_enfant_3: ["datenaissance3meenfant", "child3birthdate"],
  regime_tns: ["regimetns", "tns"],
  regime: ["votreregime", "regime", "scheme"],
  regime_conjoint: ["regimeconjoint", "spousescheme"],
  remboursement_frais: ["remboursementfrais", "reimbursement"],
  besoins_specifiques: ["besoinsspecifiques", "specificneeds", "needs"],
  assurance_date: ["assurancedate", "dateassurance", "effectivedate", "startdate"],
  deja_mutuelle: ["dejamutuelle", "mutuelleactuelle", "currentinsurance"],
  nom_mutuelle: ["nommutuelle", "mutuelle", "insurance"],
  prix_mutuelle: ["prixmutuelle", "prix", "price", "amount"],
  status: ["status", "statut", "etat", "stage"],
  notes: ["notes", "commentaire", "comment", "observation"],
};

const inferFieldForHeader = (header) => {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalized === normalizeHeader(alias))) {
      return field;
    }
  }

  if (normalized.includes("lastname") || normalized === "nom") return "nom";
  if (normalized.includes("firstname") || normalized.includes("prenom")) {
    return "prenom";
  }
  if (normalized.includes("zipcode") || normalized.includes("postal")) {
    return "code_postal";
  }
  if (
    normalized.includes("portable") ||
    normalized.includes("gsm") ||
    normalized.includes("mobile")
  ) {
    return "tel_gsm";
  }
  if (normalized.includes("statut") || normalized.includes("status")) {
    return "status";
  }
  if (normalized.includes("email") || normalized.includes("mail")) return "email";
  if (normalized.includes("adresse") || normalized.includes("address")) {
    return "adresse";
  }
  if (normalized.includes("ville") || normalized.includes("city")) return "ville";
  if (normalized.includes("profession") || normalized.includes("job")) {
    return "profession";
  }
  if (normalized.includes("naissance") || normalized.includes("birth")) {
    return "date_naissance";
  }
  if (normalized.includes("mutuelle")) return "deja_mutuelle";
  if (normalized.includes("besoin")) return "besoins_specifiques";
  if (normalized.includes("regime")) return "regime";

  return null;
};

const getRowValue = (row, aliases) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const entry = Object.entries(row).find(([key]) =>
    normalizedAliases.includes(normalizeHeader(key)),
  );
  return entry ? entry[1] : "";
};

const buildInferredRow = (row) => {
  const inferred = {};
  Object.entries(row).forEach(([header, value]) => {
    const field = inferFieldForHeader(header);
    if (field && !toText(inferred[field]) && toText(value)) {
      inferred[field] = value;
    }
  });
  return inferred;
};

const splitPostalCity = (value) => {
  const text = toText(value);
  const match = text.match(/\b(\d{5})\b\s*(.*)$/);
  return {
    code_postal: match ? match[1] : "",
    ville: match ? match[2].replace(/^[-:, ]+/, "").trim() : "",
  };
};

const normalizeImportedStatus = (value) => {
  const text = normalizeHeader(value);
  if (!text) return "NEW";
  if (["new", "nouveau", "nouvelle"].includes(text)) return "NEW";
  if (["contacted", "contacte", "appele"].includes(text)) return "CONTACTED";
  if (["interested", "interesse", "interessee"].includes(text)) {
    return "INTERESTED";
  }
  if (["qualified", "qualifie", "qualifiee"].includes(text)) {
    return "QUALIFIED";
  }
  if (["closed", "ferme", "signe", "signee"].includes(text)) return "CLOSED";
  return "NEW";
};

const rowHasContent = (row) =>
  Object.values(row).some((value) => toText(value).length > 0);

const mapExcelRowToClient = (row) => {
  const inferred = buildInferredRow(row);
  const combinedPostalCity = splitPostalCity(
    getRowValue(row, ["Code postal : Ville :", "Code postal Ville"]) ||
      `${toText(inferred.code_postal)} ${toText(inferred.ville)}`,
  );
  const extraData = {};
  Object.entries(row).forEach(([key, value]) => {
    if (toText(value)) extraData[key] = value;
  });

  const dejaMutuelle = toText(
    inferred.deja_mutuelle ||
      inferred.nom_mutuelle ||
      getRowValue(row, ["Mutuelle actuelle", "Nom mutuelle", "Mutuelle"]),
  );
  const besoinsSpecifiques = toText(
    inferred.besoins_specifiques ||
      getRowValue(row, [
        "Besoins specifiques",
        "Avez-vous des besoins specifiques",
      ]),
  );
  const rawStatus = toText(
    inferred.status || getRowValue(row, ["status", "Status", "Statut"]),
  );

  return {
    civilite: toText(inferred.civilite),
    nom: toText(inferred.nom) || "Sans nom",
    prenom: toText(inferred.prenom) || "Sans prenom",
    profession: toText(inferred.profession),
    adresse: toText(inferred.adresse) || "Non renseignee",
    adresse2: toText(inferred.adresse2),
    ville: toText(inferred.ville) || combinedPostalCity.ville || "Non renseignee",
    code_postal: toText(inferred.code_postal) || combinedPostalCity.code_postal || "00000",
    tel_fixe: toText(inferred.tel_fixe),
    tel_gsm: toText(inferred.tel_gsm),
    email: toText(inferred.email),
    tel_professionnel: toText(inferred.tel_professionnel),
    date_naissance: toText(inferred.date_naissance),
    date_naissance_conjoint: toText(inferred.date_naissance_conjoint),
    naissance_enfant_1: toText(inferred.naissance_enfant_1),
    naissance_enfant_2: toText(inferred.naissance_enfant_2),
    naissance_enfant_3: toText(inferred.naissance_enfant_3),
    regime_tns: toText(inferred.regime_tns),
    regime: toText(inferred.regime),
    regime_conjoint: toText(inferred.regime_conjoint),
    remboursement_frais: toText(inferred.remboursement_frais),
    besoins_specifiques: besoinsSpecifiques,
    assurance_date: toText(inferred.assurance_date),
    deja_mutuelle: dejaMutuelle,
    nom_mutuelle: dejaMutuelle || "Non renseignee",
    prix_mutuelle: parseFloat(inferred.prix_mutuelle) || 0,
    status: normalizeImportedStatus(rawStatus),
    notes: [toText(inferred.notes), besoinsSpecifiques, rawStatus && `Statut import: ${rawStatus}`]
      .filter(Boolean)
      .join("\n"),
    extra_data: extraData,
  };
};

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
        parseInt(offset, 10),
        parseInt(limit, 10),
        getAdminCenterId(req.user),
      );
    } else {
      const query = q.toLowerCase();
      results = (await Client.getUserClients(req.user.id, 0, 999999))
        .filter(
          (client) =>
            (client.nom || "").toLowerCase().includes(query) ||
            (client.prenom || "").toLowerCase().includes(query) ||
            (client.ville || "").toLowerCase().includes(query) ||
            (client.code_postal || "").includes(query) ||
            (client.nom_mutuelle || "").toLowerCase().includes(query) ||
            (client.email || "").toLowerCase().includes(query) ||
            (client.tel_gsm || "").toLowerCase().includes(query),
        )
        .slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));
    }

    res.json({ results, query: q });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 100;
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
    const rows = XLSX.utils.sheet_to_json(worksheet).filter(rowHasContent);
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

    const clients = await Client.assignRandomClients(userId, count, agent.center_id);
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
    res.json({ assigned: clients.length, requested: count, clients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 100;
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
    if (!client) return res.status(404).json({ error: "Client not found" });
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
    if (!centerId) return res.status(400).json({ error: "Center is required" });

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
    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!canAccessClient(req.user, client)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updates = { ...req.body };
    delete updates.center_id;
    delete updates.centerId;
    const validation = validateClient({ ...client, ...updates });
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: validation.errors });
    }
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
    if (!client) return res.status(404).json({ error: "Client not found" });
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
    if (!userId) return res.status(400).json({ error: "User ID required" });

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
