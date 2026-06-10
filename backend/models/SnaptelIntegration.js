const pool = require("../config/db");
const {
  encryptSecret,
  decryptSecret,
  generateWebhookSecret,
} = require("../utils/secretCrypto");

let schemaReady = false;

const ensureSchema = async (db = pool) => {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS snaptel_integrations (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      name VARCHAR(120) NOT NULL DEFAULT 'Snaptel',
      sda_did VARCHAR(50),
      sip_domain VARCHAR(255),
      sip_server VARCHAR(255),
      sip_transport VARCHAR(20) NOT NULL DEFAULT 'UDP',
      sip_port INTEGER NOT NULL DEFAULT 5060,
      config_notes TEXT,
      webhook_secret_encrypted TEXT,
      webhook_secret_iv TEXT,
      last_event_at TIMESTAMP,
      status VARCHAR(30) NOT NULL DEFAULT 'NOT_CONFIGURED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(center_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS snaptel_agent_mappings (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      snaptel_extension VARCHAR(50),
      snaptel_agent_id VARCHAR(100),
      sda_line VARCHAR(50),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(center_id, user_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS snaptel_webhook_logs (
      id SERIAL PRIMARY KEY,
      center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      integration_id INTEGER REFERENCES snaptel_integrations(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL,
      error_text TEXT,
      call_id VARCHAR(255),
      event_type VARCHAR(80),
      raw_payload JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_snaptel_webhook_logs_center ON snaptel_webhook_logs(center_id, created_at DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_snaptel_agent_mappings_extension ON snaptel_agent_mappings(center_id, snaptel_extension)",
  );
  schemaReady = true;
};

const mapIntegrationRow = (row) => {
  if (!row) return null;
  const hasSecret = Boolean(row.webhook_secret_encrypted && row.webhook_secret_iv);
  return {
    id: row.id,
    center_id: row.center_id,
    enabled: row.enabled,
    name: row.name,
    sda_did: row.sda_did,
    sip_domain: row.sip_domain,
    sip_server: row.sip_server,
    sip_transport: row.sip_transport,
    sip_port: row.sip_port,
    config_notes: row.config_notes,
    has_webhook_secret: hasSecret,
    last_event_at: row.last_event_at,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const getIntegrationByCenterId = async (centerId) => {
  await ensureSchema();
  const result = await pool.query(
    "SELECT * FROM snaptel_integrations WHERE center_id = $1",
    [centerId],
  );
  return mapIntegrationRow(result.rows[0]);
};

const getIntegrationById = async (id) => {
  await ensureSchema();
  const result = await pool.query(
    "SELECT * FROM snaptel_integrations WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
};

const findIntegrationBySda = async (sda) => {
  await ensureSchema();
  const text = String(sda || "").trim();
  if (!text) return null;
  const result = await pool.query(
    `SELECT * FROM snaptel_integrations
     WHERE enabled = TRUE
       AND regexp_replace(COALESCE(sda_did, ''), '[^0-9]', '', 'g') = regexp_replace($1, '[^0-9]', '', 'g')
     LIMIT 1`,
    [text],
  );
  return result.rows[0] || null;
};

const getFirstEnabledIntegration = async () => {
  await ensureSchema();
  const result = await pool.query(
    "SELECT * FROM snaptel_integrations WHERE enabled = TRUE ORDER BY id ASC LIMIT 1",
  );
  return result.rows[0] || null;
};

const upsertIntegration = async (centerId, data = {}) => {
  await ensureSchema();
  const existing = await pool.query(
    "SELECT id FROM snaptel_integrations WHERE center_id = $1",
    [centerId],
  );
  if (existing.rows[0]) {
    const result = await pool.query(
      `UPDATE snaptel_integrations SET
         enabled = COALESCE($2, enabled),
         name = COALESCE($3, name),
         sda_did = COALESCE($4, sda_did),
         sip_domain = COALESCE($5, sip_domain),
         sip_server = COALESCE($6, sip_server),
         sip_transport = COALESCE($7, sip_transport),
         sip_port = COALESCE($8, sip_port),
         config_notes = COALESCE($9, config_notes),
         status = COALESCE($10, status),
         updated_at = NOW()
       WHERE center_id = $1
       RETURNING *`,
      [
        centerId,
        data.enabled,
        data.name,
        data.sda_did,
        data.sip_domain,
        data.sip_server,
        data.sip_transport,
        data.sip_port,
        data.config_notes,
        data.status,
      ],
    );
    return mapIntegrationRow(result.rows[0]);
  }

  const { encrypted, iv } = encryptSecret(generateWebhookSecret());
  const result = await pool.query(
    `INSERT INTO snaptel_integrations
      (center_id, enabled, name, sda_did, sip_domain, sip_server, sip_transport, sip_port,
       config_notes, webhook_secret_encrypted, webhook_secret_iv, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      centerId,
      data.enabled ?? false,
      data.name || "Snaptel",
      data.sda_did || "332510",
      data.sip_domain || "68.183.12.18",
      data.sip_server || "68.183.12.18",
      data.sip_transport || "UDP",
      data.sip_port || 5060,
      data.config_notes || "",
      encrypted,
      iv,
      data.status || "NOT_CONFIGURED",
    ],
  );
  return mapIntegrationRow(result.rows[0]);
};

const regenerateWebhookSecret = async (centerId) => {
  await ensureSchema();
  const secret = generateWebhookSecret();
  const { encrypted, iv } = encryptSecret(secret);
  const result = await pool.query(
    `UPDATE snaptel_integrations SET
       webhook_secret_encrypted = $2,
       webhook_secret_iv = $3,
       updated_at = NOW()
     WHERE center_id = $1
     RETURNING *`,
    [centerId, encrypted, iv],
  );
  if (!result.rows[0]) return null;
  return { integration: mapIntegrationRow(result.rows[0]), secret };
};

const getWebhookSecret = async (integrationRow) => {
  if (!integrationRow?.webhook_secret_encrypted) return "";
  return decryptSecret(
    integrationRow.webhook_secret_encrypted,
    integrationRow.webhook_secret_iv,
  );
};

const updateIntegrationStatus = async (integrationId, { status, lastEventAt = null }) => {
  await ensureSchema();
  await pool.query(
    `UPDATE snaptel_integrations SET
       status = COALESCE($2, status),
       last_event_at = COALESCE($3, last_event_at),
       updated_at = NOW()
     WHERE id = $1`,
    [integrationId, status, lastEventAt],
  );
};

const logWebhook = async ({
  centerId,
  integrationId,
  status,
  errorText = "",
  callId = "",
  eventType = "",
  rawPayload = null,
}) => {
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO snaptel_webhook_logs
      (center_id, integration_id, status, error_text, call_id, event_type, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, center_id, integration_id, status, error_text, call_id, event_type, created_at`,
    [
      centerId || null,
      integrationId || null,
      status,
      errorText || null,
      callId || null,
      eventType || null,
      rawPayload ? JSON.stringify(rawPayload) : null,
    ],
  );
  return result.rows[0];
};

const getWebhookLogs = async (centerId, limit = 50) => {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, center_id, integration_id, status, error_text, call_id, event_type, created_at
     FROM snaptel_webhook_logs
     WHERE center_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [centerId, Math.min(limit, 100)],
  );
  return result.rows;
};

const getWebhookLogPayload = async (logId, centerId) => {
  await ensureSchema();
  const result = await pool.query(
    `SELECT raw_payload FROM snaptel_webhook_logs
     WHERE id = $1 AND center_id = $2`,
    [logId, centerId],
  );
  return result.rows[0]?.raw_payload || null;
};

const getAgentMappings = async (centerId) => {
  await ensureSchema();
  const result = await pool.query(
    `SELECT m.*, u.name AS user_name, u.email AS user_email
     FROM snaptel_agent_mappings m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.center_id = $1
     ORDER BY u.name ASC`,
    [centerId],
  );
  return result.rows;
};

const upsertAgentMapping = async (centerId, userId, data = {}) => {
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO snaptel_agent_mappings
      (center_id, user_id, snaptel_extension, snaptel_agent_id, sda_line, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (center_id, user_id) DO UPDATE SET
       snaptel_extension = COALESCE(EXCLUDED.snaptel_extension, snaptel_agent_mappings.snaptel_extension),
       snaptel_agent_id = COALESCE(EXCLUDED.snaptel_agent_id, snaptel_agent_mappings.snaptel_agent_id),
       sda_line = COALESCE(EXCLUDED.sda_line, snaptel_agent_mappings.sda_line),
       active = COALESCE(EXCLUDED.active, snaptel_agent_mappings.active),
       updated_at = NOW()
     RETURNING *`,
    [
      centerId,
      userId,
      data.snaptel_extension || null,
      data.snaptel_agent_id || null,
      data.sda_line || null,
      data.active ?? true,
    ],
  );
  return result.rows[0];
};

const findAgentByExtension = async (centerId, extension, agentId = "") => {
  await ensureSchema();
  const ext = String(extension || "").trim();
  const aid = String(agentId || "").trim();
  if (ext) {
    const result = await pool.query(
      `SELECT m.*, u.name AS user_name, u.email AS user_email
       FROM snaptel_agent_mappings m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.center_id = $1 AND m.active = TRUE
         AND m.snaptel_extension = $2
       LIMIT 1`,
      [centerId, ext],
    );
    if (result.rows[0]) return result.rows[0];
  }
  if (aid) {
    const result = await pool.query(
      `SELECT m.*, u.name AS user_name, u.email AS user_email
       FROM snaptel_agent_mappings m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.center_id = $1 AND m.active = TRUE
         AND m.snaptel_agent_id = $2
       LIMIT 1`,
      [centerId, aid],
    );
    if (result.rows[0]) return result.rows[0];
  }
  return null;
};

module.exports = {
  ensureSchema,
  getIntegrationByCenterId,
  getIntegrationById,
  findIntegrationBySda,
  getFirstEnabledIntegration,
  upsertIntegration,
  regenerateWebhookSecret,
  getWebhookSecret,
  updateIntegrationStatus,
  logWebhook,
  getWebhookLogs,
  getWebhookLogPayload,
  getAgentMappings,
  upsertAgentMapping,
  findAgentByExtension,
  mapIntegrationRow,
};
