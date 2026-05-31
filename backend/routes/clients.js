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

const CLIENT_STATUS_LABELS = {
  NEW: "Nouveau",
  TO_CALL: "A appeler",
  UNREACHABLE: "Injoignable",
  CALLBACK_SCHEDULED: "Rappel prevu",
  QUOTE_SENT: "Devis envoye",
  INTERESTED: "Interesse",
  REFUSED: "Refus",
  SIGNED: "Signe",
  LOST: "Perdu",
  CONTACTED: "Contacte",
  QUALIFIED: "Qualifie",
  CLOSED: "Ferme",
};

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
  civilite: ["civilite", "civility", "title", "sexe", "gender", "mrsmme"],
  nom: ["nom", "lastname", "surname", "familyname", "last", "clientname"],
  prenom: ["prenom", "firstname", "givenname", "forename", "first"],
  profession: ["profession", "job", "occupation", "metier"],
  adresse: ["adresse", "address", "address1", "street", "rue", "domicile"],
  adresse2: ["adresse2", "address2", "complementadresse", "complement"],
  ville: ["ville", "city", "commune", "localite", "town"],
  code_postal: ["codepostal", "zipcode", "zip", "postalcode", "cp", "postcode"],
  tel_fixe: ["telfixe", "telephonefixe", "phone", "landline"],
  tel_gsm: [
    "telgsm",
    "gsm",
    "mobile",
    "portable",
    "portablephonenumber",
    "mobilephone",
    "cellphone",
    "telephoneportable",
    "phoneportable",
    "numeroportable",
  ],
  email: ["email", "emailaddress", "mail", "courriel", "e-mail"],
  tel_professionnel: ["telprofessionnel", "workphone", "businessphone"],
  date_naissance: ["datenaissance", "birthdate", "dateofbirth", "dob"],
  date_naissance_conjoint: ["datenaissanceconjoint", "conjointbirthdate", "birthdatespouse"],
  naissance_enfant_1: ["datenaissance1erenfant", "child1birthdate", "birthdatechild1"],
  naissance_enfant_2: ["datenaissance2meenfant", "child2birthdate", "birthdatechild2"],
  naissance_enfant_3: ["datenaissance3meenfant", "child3birthdate", "birthdatechild3"],
  regime_tns: ["regimetns", "tns", "travailleurnonsalarie"],
  regime: ["votreregime", "regime", "scheme", "socialscheme"],
  regime_conjoint: ["regimeconjoint", "spousescheme"],
  remboursement_frais: ["remboursementfrais", "reimbursement"],
  besoins_specifiques: ["besoinsspecifiques", "specificneeds", "needs"],
  assurance_date: ["assurancedate", "dateassurance", "effectivedate", "startdate"],
  deja_mutuelle: ["dejamutuelle", "mutuelleactuelle", "currentinsurance"],
  nom_mutuelle: ["nommutuelle", "mutuelle", "insurance", "assurance", "insurer"],
  prix_mutuelle: ["prixmutuelle", "prix", "price", "amount", "cotisation", "premium"],
  status: ["status", "statut", "etat", "stage", "situation"],
  notes: ["notes", "commentaire", "comment", "observation", "remarks"],
};

const FIELD_KEYWORDS = {
  nom: ["nom", "last", "surname", "family"],
  prenom: ["prenom", "first", "given", "forename"],
  code_postal: ["code", "postal", "zip", "postcode"],
  tel_gsm: ["portable", "mobile", "gsm", "cell"],
  tel_fixe: ["fixe", "phone", "landline"],
  email: ["email", "mail", "courriel"],
  ville: ["ville", "city", "town", "commune"],
  adresse2: ["adresse2", "address2", "complement"],
  adresse: ["adresse", "address", "street", "rue"],
  profession: ["profession", "job", "metier", "occupation"],
  date_naissance_conjoint: ["naissance", "birth", "conjoint", "spouse"],
  date_naissance: ["naissance", "birth", "dob"],
  naissance_enfant_1: ["naissance", "birth", "enfant1", "child1"],
  naissance_enfant_2: ["naissance", "birth", "enfant2", "child2"],
  naissance_enfant_3: ["naissance", "birth", "enfant3", "child3"],
  regime_conjoint: ["regime", "conjoint", "spouse"],
  regime_tns: ["regime", "tns"],
  regime: ["regime", "scheme"],
  remboursement_frais: ["remboursement", "frais", "reimbursement"],
  besoins_specifiques: ["besoins", "specifiques", "needs"],
  assurance_date: ["assurance", "date", "effect"],
  deja_mutuelle: ["deja", "mutuelle", "actuelle", "current"],
  nom_mutuelle: ["nom", "mutuelle", "insurance", "assurance"],
  prix_mutuelle: ["prix", "mutuelle", "cotisation", "premium", "amount"],
  status: ["status", "statut", "etat", "stage"],
  notes: ["notes", "commentaire", "observation", "remarks"],
};

const levenshtein = (left, right) => {
  const matrix = Array.from({ length: left.length + 1 }, (_, row) => [row]);
  for (let column = 1; column <= right.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }
  return matrix[left.length][right.length];
};

const similarity = (left, right) => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.86;
  const maxLength = Math.max(left.length, right.length);
  return maxLength ? 1 - levenshtein(left, right) / maxLength : 0;
};

const bestFieldByScore = (normalized) => {
  let best = { field: null, score: 0 };
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const aliasScore = Math.max(
      ...aliases.map((alias) => similarity(normalized, normalizeHeader(alias))),
    );
    const keywordScore = (FIELD_KEYWORDS[field] || []).reduce(
      (score, keyword) =>
        normalized.includes(normalizeHeader(keyword)) ? score + 0.28 : score,
      0,
    );
    const score = Math.max(aliasScore, Math.min(keywordScore, 0.9));
    if (score > best.score) best = { field, score };
  }
  return best.score >= 0.72 ? best.field : null;
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
  if (
    (normalized.includes("naissance") || normalized.includes("birth")) &&
    (normalized.includes("conjoint") || normalized.includes("spouse"))
  ) {
    return "date_naissance_conjoint";
  }
  if (
    (normalized.includes("naissance") || normalized.includes("birth")) &&
    (normalized.includes("enfant1") || normalized.includes("child1"))
  ) {
    return "naissance_enfant_1";
  }
  if (
    (normalized.includes("naissance") || normalized.includes("birth")) &&
    (normalized.includes("enfant2") || normalized.includes("child2"))
  ) {
    return "naissance_enfant_2";
  }
  if (
    (normalized.includes("naissance") || normalized.includes("birth")) &&
    (normalized.includes("enfant3") || normalized.includes("child3"))
  ) {
    return "naissance_enfant_3";
  }
  if (normalized.includes("naissance") || normalized.includes("birth")) {
    return "date_naissance";
  }
  if (normalized.includes("prix") || normalized.includes("cotisation")) {
    return "prix_mutuelle";
  }
  if (normalized.includes("nom") && normalized.includes("mutuelle")) {
    return "nom_mutuelle";
  }
  if (normalized.includes("mutuelle")) return "deja_mutuelle";
  if (normalized.includes("besoin")) return "besoins_specifiques";
  if (normalized.includes("regime")) return "regime";

  return bestFieldByScore(normalized);
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
  if (["aappeler", "tocall", "appeler", "appel"].includes(text)) return "TO_CALL";
  if (["injoignable", "unreachable", "nonjoignable"].includes(text)) {
    return "UNREACHABLE";
  }
  if (["rappelprevu", "callbackscheduled", "rappel", "rdv"].includes(text)) {
    return "CALLBACK_SCHEDULED";
  }
  if (["devisenvoye", "quotesent", "devis", "proposition"].includes(text)) {
    return "QUOTE_SENT";
  }
  if (["refus", "refuse", "refused"].includes(text)) return "REFUSED";
  if (["signe", "signee", "signed", "contrat"].includes(text)) return "SIGNED";
  if (["perdu", "lost"].includes(text)) return "LOST";
  if (["contacted", "contacte", "appele"].includes(text)) return "TO_CALL";
  if (["interested", "interesse", "interessee"].includes(text)) {
    return "INTERESTED";
  }
  if (["qualified", "qualifie", "qualifiee"].includes(text)) {
    return "QUALIFIED";
  }
  if (["closed", "ferme"].includes(text)) return "SIGNED";
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

const readImportRows = (file) => {
  const workbook = XLSX.read(file.data, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet).filter(rowHasContent);
};

const analyzeImportRows = async (rows, centerId) => {
  const headerSet = new Set();
  rows.forEach((row) => Object.keys(row).forEach((header) => headerSet.add(header)));
  const recognizedColumns = [];
  const unknownColumns = [];
  Array.from(headerSet).forEach((header) => {
    const mappedTo = inferFieldForHeader(header);
    if (mappedTo) recognizedColumns.push({ source: header, mappedTo });
    else unknownColumns.push(header);
  });

  const clients = [];
  const errors = [];
  const duplicateCandidates = [];
  for (const [index, row] of rows.entries()) {
    const client = mapExcelRowToClient(row);
    client._importRow = index + 2;
    const score = Client.calculateClientScore(client);
    client.nlp_score = score.score;
    client.nlp_label = score.label;
    const validation = validateClient(client);
    if (!validation.isValid) {
      errors.push({ row: index + 2, message: validation.errors.join("; ") });
      continue;
    }
    const duplicates = centerId
      ? await Client.findPotentialDuplicates(client, centerId)
      : [];
    if (duplicates.length) {
      duplicateCandidates.push({
        row: index + 2,
        client: {
          nom: client.nom,
          prenom: client.prenom,
          email: client.email,
          tel_gsm: client.tel_gsm,
          code_postal: client.code_postal,
        },
        matches: duplicates,
      });
    }
    clients.push(client);
  }

  return {
    recognizedColumns,
    unknownColumns,
    clients,
    errors,
    duplicateCandidates,
    preview: clients.slice(0, 5).map((client) => ({
      nom: client.nom,
      prenom: client.prenom,
      ville: client.ville,
      code_postal: client.code_postal,
      email: client.email,
      tel_gsm: client.tel_gsm,
      status: client.status,
      nlp_score: client.nlp_score,
      nlp_label: client.nlp_label,
    })),
  };
};

const getClientChangeSummary = (oldClient, updatedClient, requestedUpdates) => {
  const importantFields = [
    "status",
    "notes",
    "reminder_at",
    "reminder_priority",
    "reminder_comment",
    "assigned_to",
    "nom_mutuelle",
    "prix_mutuelle",
    "email",
    "tel_gsm",
  ];
  return importantFields
    .filter((field) => Object.prototype.hasOwnProperty.call(requestedUpdates, field))
    .filter((field) => String(oldClient[field] || "") !== String(updatedClient[field] || ""))
    .reduce((changes, field) => {
      changes[field] = {
        old: oldClient[field] || null,
        new: updatedClient[field] || null,
      };
      return changes;
    }, {});
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

router.get("/statuses/list", verifyToken, (req, res) => {
  res.json(
    Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  );
});

router.post("/import/preview", verifyToken, isAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "File required" });
    }
    if (!isAllowedImportFile(req.files.file)) {
      return res.status(400).json({
        error: "Only Excel or CSV files are accepted",
      });
    }
    const centerId = resolveCenterIdForWrite(req.user, req.body);
    if (!centerId) {
      return res.status(400).json({ error: "Center is required for import" });
    }
    const rows = readImportRows(req.files.file);
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        error: `Import is limited to ${MAX_IMPORT_ROWS} rows`,
      });
    }
    const analysis = await analyzeImportRows(rows, centerId);
    res.json({
      total: rows.length,
      validRows: analysis.clients.length,
      invalidRows: analysis.errors.length,
      duplicateRows: analysis.duplicateCandidates.length,
      recognizedColumns: analysis.recognizedColumns,
      unknownColumns: analysis.unknownColumns,
      errors: analysis.errors,
      duplicateCandidates: analysis.duplicateCandidates,
      preview: analysis.preview,
    });
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

    const rows = readImportRows(req.files.file);
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        error: `Import is limited to ${MAX_IMPORT_ROWS} rows`,
      });
    }

    const centerId = resolveCenterIdForWrite(req.user, req.body);
    if (!centerId) {
      return res.status(400).json({ error: "Center is required for import" });
    }
    const analysis = await analyzeImportRows(rows, centerId);
    const skipDuplicates =
      req.body.skipDuplicates === "true" || req.body.skipDuplicates === true;
    const allowDuplicates =
      req.body.allowDuplicates === "true" || req.body.allowDuplicates === true;
    const mergeDuplicates =
      req.body.mergeDuplicates === "true" || req.body.mergeDuplicates === true;
    const duplicateRows = new Set(
      analysis.duplicateCandidates.map((item) => item.row),
    );
    let clients = skipDuplicates || mergeDuplicates
      ? analysis.clients.filter((client) => !duplicateRows.has(client._importRow))
      : analysis.clients;

    if (!skipDuplicates && !allowDuplicates && !mergeDuplicates && analysis.duplicateCandidates.length > 0) {
      return res.status(409).json({
        error: "Doublons probables detectes",
        duplicateCandidates: analysis.duplicateCandidates,
        previewRequired: true,
      });
    }

    let mergedDuplicates = 0;
    if (mergeDuplicates) {
      for (const duplicate of analysis.duplicateCandidates) {
        const incoming = analysis.clients.find(
          (client) => client._importRow === duplicate.row,
        );
        const target = duplicate.matches[0];
        if (!incoming || !target) continue;
        const updates = Object.fromEntries(
          Object.entries(incoming).filter(
            ([key, value]) =>
              !key.startsWith("_") &&
              value !== undefined &&
              value !== null &&
              String(value).trim() !== "",
          ),
        );
        const updated = await Client.updateClient(target.id, updates);
        await Client.addClientHistory({
          clientId: updated.id,
          userId: req.user.id,
          action: "MERGE_DUPLICATE",
          oldValue: target,
          newValue: updated,
          note: `Fusion depuis la ligne import ${duplicate.row}`,
        });
        mergedDuplicates += 1;
      }
    }

    if (clients.length > 0) {
      await Client.bulkInsertClients(clients, centerId);
    }

    await Log.createImportLog({
      adminId: req.user.id,
      filename: req.files.file.name,
      totalRows: rows.length,
      importedRows: clients.length,
      failedRows: analysis.errors.length,
    });

    res.json({
      message: `${clients.length} clients imported successfully`,
      imported: clients.length,
      total: rows.length,
      skippedDuplicates: skipDuplicates ? analysis.duplicateCandidates.length : 0,
      mergedDuplicates,
      errors: analysis.errors,
      duplicateCandidates: analysis.duplicateCandidates,
      preview: analysis.preview,
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

    const durationHours = parseFloat(req.body.durationHours || req.body.duration) || 24;
    const clients = await Client.assignRandomClients(userId, count, agent.center_id, durationHours);
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
    const duplicates = await Client.findPotentialDuplicates(req.body, centerId);
    if (duplicates.length && !req.body.forceCreate) {
      return res.status(409).json({
        error: "Doublon probable detecte",
        duplicates,
      });
    }

    const client = await Client.createClient({ ...req.body, center_id: centerId });
    await Client.addClientHistory({
      clientId: client.id,
      userId: req.user.id,
      action: "CREATE",
      newValue: client,
      note: "Fiche creee",
    });
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
    const changes = getClientChangeSummary(client, updatedClient, updates);
    if (Object.keys(changes).length > 0) {
      await Client.addClientHistory({
        clientId: updatedClient.id,
        userId: req.user.id,
        action: changes.status ? "STATUS_CHANGE" : "UPDATE",
        oldValue: client,
        newValue: updatedClient,
        note: updates.notes || updates.reminder_comment || "",
      });
    }
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

router.get("/:id/history", verifyToken, async (req, res) => {
  try {
    const client = await Client.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!canAccessClient(req.user, client)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const history = await Client.getClientHistory(req.params.id);
    res.json({ history });
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

    const durationHours = parseFloat(req.body.durationHours || req.body.duration) || 24;
    const client = await Client.assignClient(req.params.id, userId, durationHours);
    await Client.addClientHistory({
      clientId: client.id,
      userId: req.user.id,
      action: "ASSIGN",
      oldValue: { assigned_to: existingClient.assigned_to },
      newValue: { assigned_to: userId },
      note: `Assigne a ${agent.name}`,
    });
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
