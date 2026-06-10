const pool = require("../config/db");
const { normalizePhoneDigits } = require("../utils/phoneNormalize");

let schemaReady = false;

const ensureSchema = async (db = pool) => {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS phone_calls (
      id SERIAL PRIMARY KEY,
      center_id INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      integration_id INTEGER REFERENCES snaptel_integrations(id) ON DELETE SET NULL,
      call_id VARCHAR(255) NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      direction VARCHAR(20) CHECK (direction IN ('INBOUND', 'OUTBOUND')),
      caller_number VARCHAR(50),
      callee_number VARCHAR(50),
      normalized_caller_number VARCHAR(50),
      normalized_callee_number VARCHAR(50),
      sda VARCHAR(50),
      agent_extension VARCHAR(50),
      agent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      call_status VARCHAR(50),
      started_at TIMESTAMP,
      answered_at TIMESTAMP,
      ended_at TIMESTAMP,
      duration_seconds INTEGER,
      recording_url TEXT,
      matched_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      match_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      match_candidates JSONB DEFAULT '[]'::jsonb,
      is_test BOOLEAN NOT NULL DEFAULT FALSE,
      is_unrecognized BOOLEAN NOT NULL DEFAULT FALSE,
      ignored BOOLEAN NOT NULL DEFAULT FALSE,
      agent_notes TEXT,
      raw_payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(call_id, event_type, center_id)
    )
  `);
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_phone_calls_center ON phone_calls(center_id, created_at DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_phone_calls_agent ON phone_calls(agent_user_id, created_at DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_phone_calls_unrecognized ON phone_calls(center_id, is_unrecognized) WHERE is_unrecognized = TRUE AND ignored = FALSE",
  );
  schemaReady = true;
};

const parseTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const upsertCallEvent = async (data) => {
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO phone_calls (
       center_id, integration_id, call_id, event_type, direction,
       caller_number, callee_number, normalized_caller_number, normalized_callee_number,
       sda, agent_extension, agent_user_id, call_status,
       started_at, answered_at, ended_at, duration_seconds, recording_url,
       matched_client_id, match_status, match_candidates, is_test, is_unrecognized,
       raw_payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
     )
     ON CONFLICT (call_id, event_type, center_id) DO UPDATE SET
       direction = COALESCE(EXCLUDED.direction, phone_calls.direction),
       caller_number = COALESCE(EXCLUDED.caller_number, phone_calls.caller_number),
       callee_number = COALESCE(EXCLUDED.callee_number, phone_calls.callee_number),
       normalized_caller_number = COALESCE(EXCLUDED.normalized_caller_number, phone_calls.normalized_caller_number),
       normalized_callee_number = COALESCE(EXCLUDED.normalized_callee_number, phone_calls.normalized_callee_number),
       sda = COALESCE(EXCLUDED.sda, phone_calls.sda),
       agent_extension = COALESCE(EXCLUDED.agent_extension, phone_calls.agent_extension),
       agent_user_id = COALESCE(EXCLUDED.agent_user_id, phone_calls.agent_user_id),
       call_status = COALESCE(EXCLUDED.call_status, phone_calls.call_status),
       started_at = COALESCE(EXCLUDED.started_at, phone_calls.started_at),
       answered_at = COALESCE(EXCLUDED.answered_at, phone_calls.answered_at),
       ended_at = COALESCE(EXCLUDED.ended_at, phone_calls.ended_at),
       duration_seconds = COALESCE(EXCLUDED.duration_seconds, phone_calls.duration_seconds),
       recording_url = COALESCE(EXCLUDED.recording_url, phone_calls.recording_url),
       matched_client_id = COALESCE(EXCLUDED.matched_client_id, phone_calls.matched_client_id),
       match_status = COALESCE(EXCLUDED.match_status, phone_calls.match_status),
       match_candidates = COALESCE(EXCLUDED.match_candidates, phone_calls.match_candidates),
       is_unrecognized = COALESCE(EXCLUDED.is_unrecognized, phone_calls.is_unrecognized),
       raw_payload = COALESCE(EXCLUDED.raw_payload, phone_calls.raw_payload),
       updated_at = NOW()
     RETURNING *`,
    [
      data.centerId,
      data.integrationId || null,
      data.callId,
      data.eventType,
      data.direction || "INBOUND",
      data.callerNumber || null,
      data.calleeNumber || null,
      data.normalizedCallerNumber || normalizePhoneDigits(data.callerNumber),
      data.normalizedCalleeNumber || normalizePhoneDigits(data.calleeNumber),
      data.sda || null,
      data.agentExtension || null,
      data.agentUserId || null,
      data.callStatus || null,
      parseTimestamp(data.startedAt),
      parseTimestamp(data.answeredAt),
      parseTimestamp(data.endedAt),
      data.durationSeconds ?? null,
      data.recordingUrl || null,
      data.matchedClientId || null,
      data.matchStatus || "PENDING",
      JSON.stringify(data.matchCandidates || []),
      data.isTest || false,
      data.isUnrecognized || false,
      JSON.stringify(data.rawPayload || {}),
    ],
  );
  return result.rows[0];
};

const getCallById = async (id, centerId) => {
  await ensureSchema();
  const result = await pool.query(
    `SELECT pc.*, c.nom AS client_nom, c.prenom AS client_prenom, c.status AS client_status,
            c.nom_mutuelle, c.reminder_at, c.nlp_score, c.nlp_label, c.notes AS client_notes,
            u.name AS agent_name
     FROM phone_calls pc
     LEFT JOIN clients c ON c.id = pc.matched_client_id
     LEFT JOIN users u ON u.id = pc.agent_user_id
     WHERE pc.id = $1 AND pc.center_id = $2`,
    [id, centerId],
  );
  return result.rows[0] || null;
};

const getRecentForAgent = async (userId, centerId, { since = null, limit = 20 } = {}) => {
  await ensureSchema();
  const params = [userId, centerId];
  const filters = [
    "pc.agent_user_id = $1",
    "pc.center_id = $2",
    "pc.is_test = FALSE",
    "pc.ignored = FALSE",
  ];
  if (since) {
    params.push(since);
    filters.push(`pc.updated_at > $${params.length}`);
  }
  params.push(Math.min(limit, 50));
  const result = await pool.query(
    `SELECT pc.*, c.nom AS client_nom, c.prenom AS client_prenom, c.status AS client_status
     FROM phone_calls pc
     LEFT JOIN clients c ON c.id = pc.matched_client_id
     WHERE ${filters.join(" AND ")}
     ORDER BY pc.updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
};

const getUnrecognizedCalls = async (centerId, limit = 50) => {
  await ensureSchema();
  const result = await pool.query(
    `SELECT pc.*, u.name AS agent_name
     FROM phone_calls pc
     LEFT JOIN users u ON u.id = pc.agent_user_id
     WHERE pc.center_id = $1
       AND pc.is_unrecognized = TRUE
       AND pc.ignored = FALSE
       AND pc.is_test = FALSE
     ORDER BY pc.created_at DESC
     LIMIT $2`,
    [centerId, limit],
  );
  return result.rows;
};

const linkCallToClient = async (callId, centerId, clientId) => {
  await ensureSchema();
  const result = await pool.query(
    `UPDATE phone_calls SET
       matched_client_id = $3,
       match_status = 'LINKED',
       is_unrecognized = FALSE,
       updated_at = NOW()
     WHERE id = $1 AND center_id = $2
     RETURNING *`,
    [callId, centerId, clientId],
  );
  return result.rows[0] || null;
};

const ignoreCall = async (callId, centerId) => {
  await ensureSchema();
  const result = await pool.query(
    `UPDATE phone_calls SET ignored = TRUE, updated_at = NOW()
     WHERE id = $1 AND center_id = $2
     RETURNING *`,
    [callId, centerId],
  );
  return result.rows[0] || null;
};

const addAgentNotes = async (callId, centerId, notes) => {
  await ensureSchema();
  const result = await pool.query(
    `UPDATE phone_calls SET agent_notes = $3, updated_at = NOW()
     WHERE id = $1 AND center_id = $2
     RETURNING *`,
    [callId, centerId, notes],
  );
  return result.rows[0] || null;
};

module.exports = {
  ensureSchema,
  upsertCallEvent,
  getCallById,
  getRecentForAgent,
  getUnrecognizedCalls,
  linkCallToClient,
  ignoreCall,
  addAgentNotes,
};
