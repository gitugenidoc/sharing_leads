const pool = require("../config/db");

const createImportLog = async ({
  adminId,
  filename,
  totalRows,
  importedRows,
  failedRows,
}) => {
  await pool.query(
    `INSERT INTO import_logs
      (admin_id, filename, total_rows, imported_rows, failed_rows)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, filename, totalRows, importedRows, failedRows],
  );
};

const createAuditLog = async ({
  userId,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
}) => {
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      action,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
    ],
  );
};

const getImportLogs = async (offset = 0, limit = 100) => {
  const result = await pool.query(
    `SELECT import_logs.*, users.name AS admin_name, users.email AS admin_email
     FROM import_logs
     LEFT JOIN users ON users.id = import_logs.admin_id
     ORDER BY import_logs.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
};

const getImportLogsCount = async () => {
  const result = await pool.query("SELECT COUNT(*) FROM import_logs");
  return parseInt(result.rows[0].count, 10);
};

const getAuditLogs = async (offset = 0, limit = 100) => {
  const result = await pool.query(
    `SELECT audit_logs.*, users.name AS user_name, users.email AS user_email
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.user_id
     ORDER BY audit_logs.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
};

const getAuditLogsCount = async () => {
  const result = await pool.query("SELECT COUNT(*) FROM audit_logs");
  return parseInt(result.rows[0].count, 10);
};

module.exports = {
  createImportLog,
  createAuditLog,
  getImportLogs,
  getImportLogsCount,
  getAuditLogs,
  getAuditLogsCount,
};
