const pool = require("../config/db");

let schemaReady = false;

const ensureCommunicationMessageSchema = async (db = pool) => {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS communication_messages (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      channel VARCHAR(20) NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP')),
      direction VARCHAR(20) NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
      status VARCHAR(30) NOT NULL DEFAULT 'RECORDED',
      from_number VARCHAR(50),
      to_number VARCHAR(50),
      body TEXT,
      provider VARCHAR(50),
      provider_message_id VARCHAR(255),
      raw_payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_client_id ON communication_messages(client_id)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON communication_messages(channel)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_created_at ON communication_messages(created_at)",
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
  fromNumber = "",
  toNumber = "",
  body = "",
  provider = "",
  providerMessageId = "",
  rawPayload = {},
}) => {
  await ensureCommunicationMessageSchema();
  const normalizedChannel = normalizeChannel(channel);
  const normalizedDirection = normalizeDirection(direction);
  if (!["SMS", "WHATSAPP"].includes(normalizedChannel)) {
    throw new Error("Invalid message channel");
  }
  if (!["OUTBOUND", "INBOUND"].includes(normalizedDirection)) {
    throw new Error("Invalid message direction");
  }

  const result = await pool.query(
    `INSERT INTO communication_messages
      (client_id, user_id, channel, direction, status, from_number, to_number, body, provider, provider_message_id, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      clientId,
      userId || null,
      normalizedChannel,
      normalizedDirection,
      status || "RECORDED",
      fromNumber || null,
      toNumber || null,
      body || null,
      provider || null,
      providerMessageId || null,
      JSON.stringify(rawPayload || {}),
    ],
  );
  return result.rows[0];
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
  getClientMessages,
};
