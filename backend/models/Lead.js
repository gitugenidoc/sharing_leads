const pool = require("../config/db");

// Get all leads (admin only)
const getAllLeads = async (offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return result.rows;
};

// Get total leads count
const getLeadsCount = async () => {
  const result = await pool.query("SELECT COUNT(*) FROM leads");
  return parseInt(result.rows[0].count);
};

// Get user's assigned leads
const getUserLeads = async (userId, offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM leads WHERE assigned_to = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset],
  );
  return result.rows;
};

// Get user's assigned leads count
const getUserLeadsCount = async (userId) => {
  const result = await pool.query(
    "SELECT COUNT(*) FROM leads WHERE assigned_to = $1",
    [userId],
  );
  return parseInt(result.rows[0].count);
};

// Get lead by ID
const getLeadById = async (id) => {
  const result = await pool.query("SELECT * FROM leads WHERE id = $1", [id]);
  return result.rows[0];
};

// Create lead
const createLead = async (leadData) => {
  const { name, email, phone, status, source, amount, notes, assigned_to } =
    leadData;
  const result = await pool.query(
    "INSERT INTO leads (name, email, phone, status, source, amount, notes, assigned_to, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *",
    [
      name,
      email,
      phone,
      status || "NEW",
      source || "UNKNOWN",
      amount || 0,
      notes || "",
      assigned_to || null,
    ],
  );
  return result.rows[0];
};

// Update lead
const updateLead = async (id, leadData) => {
  const { name, email, phone, status, source, amount, notes, assigned_to } =
    leadData;
  const result = await pool.query(
    "UPDATE leads SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), status = COALESCE($4, status), source = COALESCE($5, source), amount = COALESCE($6, amount), notes = COALESCE($7, notes), assigned_to = COALESCE($8, assigned_to), updated_at = NOW() WHERE id = $9 RETURNING *",
    [name, email, phone, status, source, amount, notes, assigned_to, id],
  );
  return result.rows[0];
};

// Delete lead
const deleteLead = async (id) => {
  await pool.query("DELETE FROM leads WHERE id = $1", [id]);
};

// Bulk insert leads (for Excel import)
const bulkInsertLeads = async (leads) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const lead of leads) {
      await client.query(
        "INSERT INTO leads (name, email, phone, status, source, amount, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())",
        [
          lead.name || "",
          lead.email || "",
          lead.phone || "",
          lead.status || "NEW",
          lead.source || "IMPORT",
          lead.amount || 0,
          lead.notes || "",
        ],
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

// Assign lead to user (with assigned_at timestamp)
const assignLead = async (leadId, userId, { forceReassign = false } = {}) => {
  const result = await pool.query(
    `UPDATE leads
     SET assigned_to = $1, assigned_at = NOW(), cancellation_expiry = NULL, updated_at = NOW()
     WHERE id = $2
       AND (assigned_to IS NULL OR assigned_to = $1 OR $3 = TRUE)
     RETURNING *`,
    [userId, leadId, forceReassign],
  );
  return result.rows[0];
};

// Cancel lead temporarily for a specified duration (in hours)
const cancelLeadTemporarily = async (leadId, durationHours) => {
  const expiryTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  const result = await pool.query(
    "UPDATE leads SET cancellation_expiry = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [expiryTime, leadId],
  );
  return result.rows[0];
};

// Check if a lead is currently cancelled
const isLeadCancelled = async (leadId) => {
  const result = await pool.query(
    "SELECT cancellation_expiry FROM leads WHERE id = $1",
    [leadId],
  );
  if (!result.rows[0]) return false;

  const { cancellation_expiry } = result.rows[0];
  if (!cancellation_expiry) return false;

  return new Date(cancellation_expiry) > new Date();
};

// Get user's active (non-cancelled) assigned leads
const getActiveUserLeads = async (userId, offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM leads WHERE assigned_to = $1 AND (cancellation_expiry IS NULL OR cancellation_expiry < NOW()) ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset],
  );
  return result.rows;
};

// Get user's active leads count
const getActiveUserLeadsCount = async (userId) => {
  const result = await pool.query(
    "SELECT COUNT(*) FROM leads WHERE assigned_to = $1 AND (cancellation_expiry IS NULL OR cancellation_expiry < NOW())",
    [userId],
  );
  return parseInt(result.rows[0].count);
};

// Search leads
const searchLeads = async (query, offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM leads WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [`%${query}%`, limit, offset],
  );
  return result.rows;
};

module.exports = {
  getAllLeads,
  getLeadsCount,
  getUserLeads,
  getUserLeadsCount,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  bulkInsertLeads,
  assignLead,
  searchLeads,
  cancelLeadTemporarily,
  isLeadCancelled,
  getActiveUserLeads,
  getActiveUserLeadsCount,
};
