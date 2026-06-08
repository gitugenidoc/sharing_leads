const pool = require("../config/db");

let schemaReady = false;

const ensureCommunicationMessageSchema = async (db = pool) => {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS communication_messages (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      channel VARCHAR(20) NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'CALL')),
      direction VARCHAR(20) NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
      status VARCHAR(30) NOT NULL DEFAULT 'RECORDED',
      message_type VARCHAR(30) NOT NULL DEFAULT 'text',
      from_number VARCHAR(50),
      to_number VARCHAR(50),
      body TEXT,
      media_id VARCHAR(255),
      media_mime_type VARCHAR(255),
      media_sha256 VARCHAR(255),
      media_filename VARCHAR(255),
      media_caption TEXT,
      provider VARCHAR(50),
      provider_message_id VARCHAR(255),
      error_text TEXT,
      delivered_at TIMESTAMP,
      read_at TIMESTAMP,
      raw_payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query("ALTER TABLE communication_messages ALTER COLUMN client_id DROP NOT NULL");
  await db.query(
    "ALTER TABLE communication_messages DROP CONSTRAINT IF EXISTS communication_messages_channel_check",
  );
  await db.query(`
    ALTER TABLE communication_messages
    ADD CONSTRAINT communication_messages_channel_check
    CHECK (channel IN ('SMS', 'WHATSAPP', 'CALL'))
  `);
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) NOT NULL DEFAULT 'text'");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS media_id VARCHAR(255)");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(255)");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS media_sha256 VARCHAR(255)");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS media_filename VARCHAR(255)");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS media_caption TEXT");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS error_text TEXT");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP");
  await db.query("ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP");
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_client_id ON communication_messages(client_id)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON communication_messages(channel)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_created_at ON communication_messages(created_at)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_provider_id ON communication_messages(provider_message_id)",
  );
  schemaReady = true;
};

const normalizeChannel = (channel) => String(channel || "").toUpperCase();
const normalizeDirection = (direction) => String(direction || "").toUpperCase();

const createMessage = async ({
  clientId,
  userId = null,
  channel,
  direction,
  status = "RECORDED",
  messageType = "text",
  fromNumber = "",
  toNumber = "",
  body = "",
  mediaId = "",
  mediaMimeType = "",
  mediaSha256 = "",
  mediaFilename = "",
  mediaCaption = "",
  provider = "",
  providerMessageId = "",
  errorText = "",
  deliveredAt = null,
  readAt = null,
  rawPayload = {},
}) => {
  await ensureCommunicationMessageSchema();
  const normalizedChannel = normalizeChannel(channel);
  const normalizedDirection = normalizeDirection(direction);
  if (!["SMS", "WHATSAPP", "CALL"].includes(normalizedChannel)) {
    throw new Error("Invalid message channel");
  }
  if (!["OUTBOUND", "INBOUND"].includes(normalizedDirection)) {
    throw new Error("Invalid message direction");
  }

  const result = await pool.query(
    `INSERT INTO communication_messages
      (client_id, user_id, channel, direction, status, message_type, from_number, to_number, body,
       media_id, media_mime_type, media_sha256, media_filename, media_caption,
       provider, provider_message_id, error_text, delivered_at, read_at, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      clientId || null,
      userId || null,
      normalizedChannel,
      normalizedDirection,
      status || "RECORDED",
      messageType || "text",
      fromNumber || null,
      toNumber || null,
      body || null,
      mediaId || null,
      mediaMimeType || null,
      mediaSha256 || null,
      mediaFilename || null,
      mediaCaption || null,
      provider || null,
      providerMessageId || null,
      errorText || null,
      deliveredAt || null,
      readAt || null,
      JSON.stringify(rawPayload || {}),
    ],
  );
  return result.rows[0];
};

const updateProviderStatus = async ({
  providerMessageId,
  status,
  errorText = "",
  deliveredAt = null,
  readAt = null,
  rawPayload = {},
}) => {
  await ensureCommunicationMessageSchema();
  if (!providerMessageId) return null;
  const fields = ["status = COALESCE($2, status)", "raw_payload = COALESCE($3, raw_payload)"];
  const values = [
    providerMessageId,
    status || null,
    rawPayload ? JSON.stringify(rawPayload) : null,
  ];
  if (errorText) {
    values.push(errorText);
    fields.push(`error_text = $${values.length}`);
  }
  if (deliveredAt) {
    values.push(deliveredAt);
    fields.push(`delivered_at = $${values.length}`);
  }
  if (readAt) {
    values.push(readAt);
    fields.push(`read_at = $${values.length}`);
  }
  const result = await pool.query(
    `UPDATE communication_messages
     SET ${fields.join(", ")}
     WHERE provider_message_id = $1
     RETURNING *`,
    values,
  );
  return result.rows[0] || null;
};

const getClientMessages = async (clientId, channel = null, limit = 100) => {
  await ensureCommunicationMessageSchema();
  const params = [clientId, limit];
  let channelFilter = "";
  if (channel) {
    params.push(normalizeChannel(channel));
    channelFilter = `AND communication_messages.channel = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT communication_messages.*, users.name AS user_name, users.email AS user_email
     FROM communication_messages
     LEFT JOIN users ON users.id = communication_messages.user_id
     WHERE communication_messages.client_id = $1
       ${channelFilter}
     ORDER BY communication_messages.created_at DESC
     LIMIT $2`,
    params,
  );
  return result.rows;
};

module.exports = {
  ensureCommunicationMessageSchema,
  createMessage,
  updateProviderStatus,
  getClientMessages,
};
