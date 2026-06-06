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
  "reminder_at",
  "reminder_priority",
  "reminder_comment",
  "nlp_score",
  "nlp_label",
  "last_contacted_at",
  "last_action_at",
  "closed_by",
  "closed_at",
  "center_id",
  "extra_data",
  "validation_status",
  "validation_reason",
  "validated_by",
  "validated_at",
];

const TERMINAL_CLIENT_STATUSES = ["SIGNED", "LOST", "CLOSED", "REFUSED"];
const terminalStatusPlaceholders = (startIndex = 1) =>
  TERMINAL_CLIENT_STATUSES.map((_, index) => `$${startIndex + index}`).join(", ");

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
  ["reminder_at", "TIMESTAMP"],
  ["reminder_priority", "VARCHAR(20) DEFAULT 'NORMAL'"],
  ["reminder_comment", "TEXT"],
  ["nlp_score", "INTEGER DEFAULT 0"],
  ["nlp_label", "VARCHAR(30) DEFAULT 'INCOMPLET'"],
  ["last_contacted_at", "TIMESTAMP"],
  ["last_action_at", "TIMESTAMP"],
  ["closed_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL"],
  ["closed_at", "TIMESTAMP"],
  ["extra_data", "JSONB DEFAULT '{}'::jsonb"],
  ["validation_status", "VARCHAR(20) DEFAULT 'PENDING'"],
  ["validation_reason", "TEXT"],
  ["validated_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL"],
  ["validated_at", "TIMESTAMP"],
];

let schemaReady = false;

const ensureFlexibleClientColumns = async (db = pool) => {
  if (schemaReady) return;
  for (const [column, definition] of FLEXIBLE_CLIENT_COLUMNS) {
    await db.query(
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
    );
  }
  await db.query("ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check");
  await db.query(`
    ALTER TABLE clients
    ADD CONSTRAINT clients_status_check
    CHECK (status IN (
      'NEW',
      'TO_CALL',
      'UNREACHABLE',
      'CALLBACK_SCHEDULED',
      'QUOTE_SENT',
      'INTERESTED',
      'REFUSED',
      'SIGNED',
      'LOST',
      'CONTACTED',
      'QUALIFIED',
      'CLOSED'
    ))
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query("CREATE INDEX IF NOT EXISTS idx_client_history_client_id ON client_history(client_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_client_history_created_at ON client_history(created_at)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_clients_reminder_at ON clients(reminder_at)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_clients_nlp_label ON clients(nlp_label)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_clients_closed_by ON clients(closed_by)");
  schemaReady = true;
};

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizePhoneDigits = (phone) => toText(phone).replace(/[^\d]/g, "");

const getPhoneVariants = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return [];
  const variants = new Set([digits]);
  if (digits.startsWith("33") && digits.length > 2) {
    variants.add(`0${digits.slice(2)}`);
  }
  if (digits.startsWith("0") && digits.length > 1) {
    variants.add(`33${digits.slice(1)}`);
  }
  if (digits.startsWith("212") && digits.length > 3) {
    variants.add(`0${digits.slice(3)}`);
  }
  return [...variants];
};

const calculateClientScore = (clientData) => {
  const checks = [
    toText(clientData.nom) && toText(clientData.prenom),
    toText(clientData.email),
    toText(clientData.tel_gsm) || toText(clientData.tel_fixe),
    toText(clientData.ville) && toText(clientData.code_postal),
    toText(clientData.nom_mutuelle),
    parseFloat(clientData.prix_mutuelle) > 0,
    toText(clientData.status) && clientData.status !== "NEW",
    toText(clientData.notes) || toText(clientData.besoins_specifiques),
  ];
  const score = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100,
  );
  let label = "INCOMPLET";
  if (score >= 75) label = "CHAUD";
  else if (score >= 45) label = "MOYEN";
  return { score, label };
};

const normalizeClientData = (clientData) => ({
  ...clientData,
  nom_mutuelle: clientData.nom_mutuelle || "",
  prix_mutuelle:
    clientData.prix_mutuelle === undefined ||
    clientData.prix_mutuelle === null ||
    clientData.prix_mutuelle === ""
      ? 0
      : clientData.prix_mutuelle,
  status: clientData.status || "NEW",
  notes: clientData.notes || "",
  reminder_priority: clientData.reminder_priority || "NORMAL",
  nlp_score:
    clientData.nlp_score === undefined || clientData.nlp_score === null
      ? calculateClientScore(clientData).score
      : clientData.nlp_score,
  nlp_label:
    clientData.nlp_label || calculateClientScore(clientData).label,
  last_action_at: clientData.last_action_at || null,
  extra_data: clientData.extra_data || {},
});

const serializeFieldValue = (field, value) => {
  if (field === "extra_data") {
    return JSON.stringify(value || {});
  }
  if (
    ["assigned_at", "assignment_expires_at", "reminder_at", "last_contacted_at", "last_action_at", "closed_at"].includes(field) &&
    (value === "" || value === undefined)
  ) {
    return null;
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

const releaseExpiredAssignments = async ({ silent = false } = {}) => {
  try {
    const result = await pool.query(
      `UPDATE clients 
       SET assigned_to = NULL, assigned_at = NULL, assignment_expires_at = NULL, updated_at = NOW() 
       WHERE assigned_to IS NOT NULL 
         AND assignment_expires_at IS NOT NULL 
         AND assignment_expires_at < NOW()
       RETURNING id`
    );
    if (!silent && result.rowCount > 0) {
      console.log(`[Auto-Release] Released ${result.rowCount} expired client assignments.`);
    }
    return { released: result.rowCount, ids: result.rows.map((row) => row.id) };
  } catch (err) {
    console.error("[Auto-Release] Error releasing expired assignments:", err);
    throw err;
  }
};

const getAllClients = async (offset = 0, limit = 100, centerId = null) => {
  await ensureFlexibleClientColumns();
  const params = [...TERMINAL_CLIENT_STATUSES, limit, offset];
  const centerFilter = centerId ? ` AND center_id = $${params.length + 1}` : "";
  if (centerId) params.push(centerId);
  const result = await pool.query(
    `SELECT * FROM clients
     WHERE status NOT IN (${terminalStatusPlaceholders(1)})
       ${centerFilter}
     ORDER BY created_at DESC
     LIMIT $${TERMINAL_CLIENT_STATUSES.length + 1}
     OFFSET $${TERMINAL_CLIENT_STATUSES.length + 2}`,
    params,
  );
  return result.rows;
};

const getClientsCount = async (centerId = null) => {
  const params = [...TERMINAL_CLIENT_STATUSES];
  const centerFilter = centerId ? ` AND center_id = $${params.length + 1}` : "";
  if (centerId) params.push(centerId);
  const result = await pool.query(
    `SELECT COUNT(*) FROM clients
     WHERE status NOT IN (${terminalStatusPlaceholders(1)})
       ${centerFilter}`,
    params,
  );
  return parseInt(result.rows[0].count, 10);
};

const getUserClients = async (userId, offset = 0, limit = 100) => {
  await ensureFlexibleClientColumns();
  const result = await pool.query(
    `SELECT * FROM clients
     WHERE (assigned_to = $1 AND (assignment_expires_at IS NULL OR assignment_expires_at >= NOW()))
       AND status NOT IN (${terminalStatusPlaceholders(4)})
     ORDER BY
       COALESCE(last_action_at, updated_at, created_at) DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset, ...TERMINAL_CLIENT_STATUSES],
  );
  return result.rows;
};

const getUserClientsCount = async (userId) => {
  await ensureFlexibleClientColumns();
  const result = await pool.query(
    `SELECT COUNT(*) FROM clients
     WHERE (assigned_to = $1 AND (assignment_expires_at IS NULL OR assignment_expires_at >= NOW()))
       AND status NOT IN (${terminalStatusPlaceholders(2)})`,
    [userId, ...TERMINAL_CLIENT_STATUSES],
  );
  return parseInt(result.rows[0].count, 10);
};

const getClosedClients = async (offset = 0, limit = 100, centerId = null) => {
  await ensureFlexibleClientColumns();
  const params = [...TERMINAL_CLIENT_STATUSES, limit, offset];
  const centerFilter = centerId ? ` AND clients.center_id = $${params.length + 1}` : "";
  if (centerId) params.push(centerId);
  const result = await pool.query(
    `SELECT
       clients.*,
       users.name AS agent_name,
       users.email AS agent_email,
       closed_user.name AS closed_by_name
     FROM clients
     LEFT JOIN users ON users.id = clients.assigned_to
     LEFT JOIN users AS closed_user ON closed_user.id = clients.closed_by
     WHERE clients.status IN (${terminalStatusPlaceholders(1)})
       ${centerFilter}
     ORDER BY clients.closed_at DESC NULLS LAST, clients.updated_at DESC
     LIMIT $${TERMINAL_CLIENT_STATUSES.length + 1}
     OFFSET $${TERMINAL_CLIENT_STATUSES.length + 2}`,
    params,
  );
  return result.rows;
};

const getClosedClientsCount = async (centerId = null) => {
  await ensureFlexibleClientColumns();
  const params = [...TERMINAL_CLIENT_STATUSES];
  const centerFilter = centerId ? ` AND center_id = $${params.length + 1}` : "";
  if (centerId) params.push(centerId);
  const result = await pool.query(
    `SELECT COUNT(*) FROM clients
     WHERE status IN (${terminalStatusPlaceholders(1)})
       ${centerFilter}`,
    params,
  );
  return parseInt(result.rows[0].count, 10);
};

const getReminderClients = async (user) => {
  await ensureFlexibleClientColumns();
  const params = [];
  let scopeFilter = "";
  if (user.role === "AGENT") {
    params.push(user.id);
    scopeFilter = `AND clients.assigned_to = $${params.length}`;
  } else if (["ADMIN", "SUPERVISOR"].includes(user.role)) {
    params.push(user.center_id || -1);
    scopeFilter = `AND clients.center_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT
       clients.*,
       users.name AS agent_name,
       users.email AS agent_email
     FROM clients
     LEFT JOIN users ON users.id = clients.assigned_to
     WHERE clients.reminder_at IS NOT NULL
       AND clients.reminder_at <= NOW() + INTERVAL '1 hour'
       AND clients.status NOT IN ('SIGNED', 'LOST', 'CLOSED', 'REFUSED')
       ${scopeFilter}
     ORDER BY
       CASE WHEN clients.reminder_at < NOW() THEN 0 ELSE 1 END,
       CASE clients.reminder_priority
         WHEN 'HIGH' THEN 0
         WHEN 'NORMAL' THEN 1
         WHEN 'LOW' THEN 2
         ELSE 3
       END,
       clients.reminder_at ASC
     LIMIT 200`,
    params,
  );
  return result.rows;
};

const getClientById = async (id) => {
  const result = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
  return result.rows[0];
};

const createClient = async (clientData) => {
  await ensureFlexibleClientColumns();
  const score = calculateClientScore(clientData);
  const insert = buildInsertQuery({
    ...clientData,
    nlp_score: score.score,
    nlp_label: score.label,
  });
  const result = await pool.query(insert.text, insert.values);
  return result.rows[0];
};

const updateClient = async (id, clientData) => {
  await ensureFlexibleClientColumns();
  const current = await getClientById(id);
  const score = calculateClientScore({ ...current, ...clientData });
  if (
    Object.keys(clientData).some((field) =>
      [
        "nom",
        "prenom",
        "email",
        "tel_gsm",
        "tel_fixe",
        "ville",
        "code_postal",
        "nom_mutuelle",
        "prix_mutuelle",
        "status",
        "notes",
        "besoins_specifiques",
      ].includes(field),
    )
  ) {
    clientData.nlp_score = score.score;
    clientData.nlp_label = score.label;
  }
  if (!Object.prototype.hasOwnProperty.call(clientData, "last_action_at")) {
    clientData.last_action_at = new Date();
  }
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

const assignClient = async (
  clientId,
  userId,
  durationHours = null,
  { forceReassign = false } = {},
) => {
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
       AND (assigned_to IS NULL OR assigned_to = $1 OR $4 = TRUE)
     RETURNING *`,
    [userId, expiresAt, clientId, forceReassign],
  );
  return result.rows[0];
};

const assignRandomClients = async (userId, count, centerId, durationHours = null) => {
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
       WHERE assigned_to IS NULL
         AND center_id = $4
       ORDER BY
         CASE
           WHEN reminder_at IS NOT NULL AND reminder_at <= NOW() THEN 0
           WHEN status IN ('TO_CALL', 'CALLBACK_SCHEDULED', 'NEW') THEN 1
           WHEN status IN ('INTERESTED', 'QUOTE_SENT') THEN 2
           ELSE 3
         END,
         CASE reminder_priority
           WHEN 'HIGH' THEN 0
           WHEN 'NORMAL' THEN 1
           WHEN 'LOW' THEN 2
           ELSE 3
         END,
         nlp_score DESC NULLS LAST,
         created_at ASC
       LIMIT $3
     )
     RETURNING *`,
    [userId, expiresAt, count, centerId],
  );
  return result.rows;
};

const normalizeDuplicateValue = (value) =>
  toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]/g, "");

const findPotentialDuplicates = async (clientData, centerId, db = pool) => {
  await ensureFlexibleClientColumns(db);
  const email = normalizeDuplicateValue(clientData.email);
  const phone = normalizeDuplicateValue(clientData.tel_gsm || clientData.tel_fixe);
  const nom = normalizeDuplicateValue(clientData.nom);
  const prenom = normalizeDuplicateValue(clientData.prenom);
  const codePostal = normalizeDuplicateValue(clientData.code_postal);
  const params = [centerId];
  const conditions = [];

  if (email) {
    params.push(email);
    conditions.push(`LOWER(REGEXP_REPLACE(COALESCE(email, ''), '[^a-zA-Z0-9@.]', '', 'g')) = $${params.length}`);
  }
  if (phone) {
    params.push(phone);
    conditions.push(`REGEXP_REPLACE(COALESCE(tel_gsm, tel_fixe, ''), '[^0-9]', '', 'g') = $${params.length}`);
  }
  if (nom && prenom && codePostal) {
    params.push(nom, prenom, codePostal);
    conditions.push(`(
      LOWER(REGEXP_REPLACE(COALESCE(nom, ''), '[^a-zA-Z0-9]', '', 'g')) = $${params.length - 2}
      AND LOWER(REGEXP_REPLACE(COALESCE(prenom, ''), '[^a-zA-Z0-9]', '', 'g')) = $${params.length - 1}
      AND REGEXP_REPLACE(COALESCE(code_postal, ''), '[^0-9]', '', 'g') = $${params.length}
    )`);
  }

  if (!conditions.length) return [];
  const result = await db.query(
    `SELECT id, nom, prenom, email, tel_gsm, tel_fixe, code_postal, ville, status, assigned_to, nlp_label
     FROM clients
     WHERE center_id = $1 AND (${conditions.join(" OR ")})
     ORDER BY created_at DESC
     LIMIT 5`,
    params,
  );
  return result.rows;
};

const addClientHistory = async ({
  clientId,
  userId,
  action,
  oldValue = null,
  newValue = null,
  note = "",
}) => {
  await ensureFlexibleClientColumns();
  await pool.query(
    `INSERT INTO client_history (client_id, user_id, action, old_value, new_value, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      clientId,
      userId || null,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      note || null,
    ],
  );
};

const getClientHistory = async (clientId) => {
  await ensureFlexibleClientColumns();
  const result = await pool.query(
    `SELECT client_history.*, users.name AS user_name, users.email AS user_email
     FROM client_history
     LEFT JOIN users ON users.id = client_history.user_id
     WHERE client_history.client_id = $1
     ORDER BY client_history.created_at DESC`,
    [clientId],
  );
  return result.rows;
};

const searchClients = async (query, offset = 0, limit = 100, centerId = null) => {
  await ensureFlexibleClientColumns();
  const params = [`%${query}%`, limit, offset];
  let centerFilter = "";
  if (centerId) {
    params.push(centerId);
    centerFilter = "AND center_id = $4";
  }
  const statusFilter = `AND status NOT IN (${terminalStatusPlaceholders(params.length + 1)})`;
  params.push(...TERMINAL_CLIENT_STATUSES);

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
     ${statusFilter}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params,
  );
  return result.rows;
};

const findClientByPhone = async (phone) => {
  await ensureFlexibleClientColumns();
  const variants = getPhoneVariants(phone);
  if (!variants.length) return null;
  const result = await pool.query(
    `SELECT *
     FROM clients
     WHERE regexp_replace(COALESCE(tel_gsm, ''), '[^0-9]', '', 'g') = ANY($1)
        OR regexp_replace(COALESCE(tel_fixe, ''), '[^0-9]', '', 'g') = ANY($1)
        OR regexp_replace(COALESCE(tel_professionnel, ''), '[^0-9]', '', 'g') = ANY($1)
     ORDER BY COALESCE(last_action_at, updated_at, created_at) DESC
     LIMIT 1`,
    [variants],
  );
  return result.rows[0] || null;
};

const bulkInsertClients = async (clients, centerId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureFlexibleClientColumns(client);
    for (const row of clients) {
      const score = calculateClientScore(row);
      await client.query(
        `INSERT INTO clients
          (${CLIENT_FIELDS.join(", ")}, created_at, updated_at)
         VALUES (${CLIENT_FIELDS.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())`,
        buildInsertQuery({
          ...row,
          center_id: centerId,
          nlp_score: score.score,
          nlp_label: score.label,
        }).values,
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
  getClosedClients,
  getClosedClientsCount,
  getUserClients,
  getUserClientsCount,
  getReminderClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  assignClient,
  assignRandomClients,
  searchClients,
  findClientByPhone,
  bulkInsertClients,
  findPotentialDuplicates,
  addClientHistory,
  getClientHistory,
  calculateClientScore,
  ensureFlexibleClientColumns,
  releaseExpiredAssignments,
};
