const pool = require("../config/db");

const CLIENT_FIELDS = [
  "nom",
  "prenom",
  "adresse",
  "adresse2",
  "ville",
  "code_postal",
  "civilite",
  "profession",
  "tel_fixe",
  "tel_gsm",
  "email",
  "tel_professionnel",
  "date_naissance",
  "date_naissance_conjoint",
  "naissance_enfant_1",
  "naissance_enfant_2",
  "naissance_enfant_3",
  "regime_tns",
  "regime",
  "regime_conjoint",
  "remboursement_frais",
  "besoins_specifiques",
  "assurance_date",
  "deja_mutuelle",
  "nom_mutuelle",
  "prix_mutuelle",
  "status",
  "notes",
  "assigned_to",
  "assigned_at",
  "assignment_expires_at",
  "center_id",
  "extra_data",
];

const FLEXIBLE_CLIENT_COLUMNS = [
  ["adresse2", "VARCHAR(500)"],
  ["civilite", "VARCHAR(50)"],
  ["profession", "VARCHAR(255)"],
  ["tel_fixe", "VARCHAR(50)"],
  ["tel_gsm", "VARCHAR(50)"],
  ["email", "VARCHAR(255)"],
  ["tel_professionnel", "VARCHAR(50)"],
  ["date_naissance", "VARCHAR(50)"],
  ["date_naissance_conjoint", "VARCHAR(50)"],
  ["naissance_enfant_1", "VARCHAR(50)"],
  ["naissance_enfant_2", "VARCHAR(50)"],
  ["naissance_enfant_3", "VARCHAR(50)"],
  ["regime_tns", "VARCHAR(255)"],
  ["regime", "VARCHAR(255)"],
  ["regime_conjoint", "VARCHAR(255)"],
  ["remboursement_frais", "TEXT"],
  ["besoins_specifiques", "TEXT"],
  ["assurance_date", "VARCHAR(100)"],
  ["deja_mutuelle", "VARCHAR(255)"],
  ["extra_data", "JSONB DEFAULT '{}'::jsonb"],
];

let schemaReady = false;

const ensureFlexibleClientColumns = async (db = pool) => {
  if (schemaReady) return;
  for (const [column, definition] of FLEXIBLE_CLIENT_COLUMNS) {
    await db.query(
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
    );
  }
  schemaReady = true;
};

const normalizeClientData = (clientData) => ({
  ...clientData,
  nom_mutuelle: clientData.nom_mutuelle || "Non renseignee",
  prix_mutuelle:
    clientData.prix_mutuelle === undefined ||
    clientData.prix_mutuelle === null ||
    clientData.prix_mutuelle === ""
      ? 0
      : clientData.prix_mutuelle,
  status: clientData.status || "NEW",
  notes: clientData.notes || "",
  extra_data: clientData.extra_data || {},
});

const serializeFieldValue = (field, value) => {
  if (field === "extra_data") {
    return JSON.stringify(value || {});
  }
  return value === undefined ? null : value;
};

const buildInsertQuery = (clientData) => {
  const data = normalizeClientData(clientData);
  const values = CLIENT_FIELDS.map((field) => serializeFieldValue(field, data[field]));
  const placeholders = CLIENT_FIELDS.map((_, index) => `$${index + 1}`).join(", ");
  return {
    text: `INSERT INTO clients
      (${CLIENT_FIELDS.join(", ")}, created_at, updated_at)
     VALUES (${placeholders}, NOW(), NOW())
     RETURNING *`,
    values,
  };
};

const withCenterFilter = (baseQuery, centerId, nextParamIndex) => {
  if (!centerId) {
    return { text: baseQuery, params: [] };
  }
  return {
    text: `${baseQuery} WHERE clients.center_id = $${nextParamIndex}`,
    params: [centerId],
  };
};

const releaseExpiredAssignments = async () => {
  try {
    const result = await pool.query(
      `UPDATE clients 
       SET assigned_to = NULL, assigned_at = NULL, assignment_expires_at = NULL, updated_at = NOW() 
       WHERE assigned_to IS NOT NULL 
         AND assignment_expires_at IS NOT NULL 
         AND assignment_expires_at < NOW()
       RETURNING id`
    );
    if (result.rowCount > 0) {
      console.log(`[Auto-Release] Released ${result.rowCount} expired client assignments.`);
    }
  } catch (err) {
    console.error("[Auto-Release] Error releasing expired assignments:", err);
  }
};

const getAllClients = async (offset = 0, limit = 100, centerId = null) => {
  await releaseExpiredAssignments();
  const scope = withCenterFilter("SELECT * FROM clients", centerId, 3);
  const result = await pool.query(
    `${scope.text} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset, ...scope.params],
  );
  return result.rows;
};

const getClientsCount = async (centerId = null) => {
  await releaseExpiredAssignments();
  const scope = withCenterFilter("SELECT COUNT(*) FROM clients", centerId, 1);
  const result = await pool.query(scope.text, scope.params);
  return parseInt(result.rows[0].count, 10);
};

const getUserClients = async (userId, offset = 0, limit = 100) => {
  await releaseExpiredAssignments();
  const result = await pool.query(
    "SELECT * FROM clients WHERE assigned_to = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset],
  );
  return result.rows;
};

const getUserClientsCount = async (userId) => {
  await releaseExpiredAssignments();
  const result = await pool.query(
    "SELECT COUNT(*) FROM clients WHERE assigned_to = $1",
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
};

const getClientById = async (id) => {
  await releaseExpiredAssignments();
  const result = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
  return result.rows[0];
};

const createClient = async (clientData) => {
  await ensureFlexibleClientColumns();
  const insert = buildInsertQuery(clientData);
  const result = await pool.query(insert.text, insert.values);
  return result.rows[0];
};

const updateClient = async (id, clientData) => {
  await ensureFlexibleClientColumns();
  const fields = CLIENT_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(clientData, field),
  );
  if (fields.length === 0) {
    return getClientById(id);
  }
  const values = fields.map((field) => serializeFieldValue(field, clientData[field]));
  values.push(id);
  const result = await pool.query(
    `UPDATE clients SET
      ${fields.map((field, index) => `${field} = $${index + 1}`).join(", ")},
      updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values,
  );
  return result.rows[0];
};

const deleteClient = async (id) => {
  await pool.query("DELETE FROM clients WHERE id = $1", [id]);
};

const assignClient = async (clientId, userId, durationHours = 24) => {
  let expiresAt = null;
  if (durationHours && durationHours > 0) {
    expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseFloat(durationHours));
  }
  
  const result = await pool.query(
    `UPDATE clients 
     SET assigned_to = $1, 
         assigned_at = NOW(), 
         assignment_expires_at = $2, 
         updated_at = NOW() 
     WHERE id = $3 
     RETURNING *`,
    [userId, expiresAt, clientId],
  );
  return result.rows[0];
};

const assignRandomClients = async (userId, count, centerId, durationHours = 24) => {
  await releaseExpiredAssignments();
  let expiresAt = null;
  if (durationHours && durationHours > 0) {
    expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseFloat(durationHours));
  }

  const result = await pool.query(
    `UPDATE clients
     SET assigned_to = $1, 
         assigned_at = NOW(), 
         assignment_expires_at = $2, 
         updated_at = NOW()
     WHERE id IN (
       SELECT id
       FROM clients
       WHERE (assigned_to IS NULL OR assignment_expires_at < NOW())
         AND center_id = $4
       ORDER BY RANDOM()
       LIMIT $3
     )
     RETURNING *`,
    [userId, expiresAt, count, centerId],
  );
  return result.rows;
};

const searchClients = async (query, offset = 0, limit = 100, centerId = null) => {
  await releaseExpiredAssignments();
  await ensureFlexibleClientColumns();
  const params = [`%${query}%`, limit, offset];
  let centerFilter = "";
  if (centerId) {
    params.push(centerId);
    centerFilter = "AND center_id = $4";
  }

  const result = await pool.query(
    `SELECT * FROM clients
     WHERE (
       nom ILIKE $1
       OR prenom ILIKE $1
       OR ville ILIKE $1
       OR code_postal ILIKE $1
       OR nom_mutuelle ILIKE $1
       OR email ILIKE $1
       OR tel_gsm ILIKE $1
       OR tel_fixe ILIKE $1
       OR profession ILIKE $1
     )
     ${centerFilter}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params,
  );
  return result.rows;
};

const bulkInsertClients = async (clients, centerId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureFlexibleClientColumns(client);
    for (const row of clients) {
      await client.query(
        `INSERT INTO clients
          (${CLIENT_FIELDS.join(", ")}, created_at, updated_at)
         VALUES (${CLIENT_FIELDS.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())`,
        buildInsertQuery({ ...row, center_id: centerId }).values,
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllClients,
  getClientsCount,
  getUserClients,
  getUserClientsCount,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  assignClient,
  assignRandomClients,
  searchClients,
  bulkInsertClients,
  ensureFlexibleClientColumns,
};
