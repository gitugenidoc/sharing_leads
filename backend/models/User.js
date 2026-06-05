const pool = require("../config/db");

const query = (text, params) => pool.query(text, params);

const USER_SELECT = `
  SELECT users.id, users.email, users.name, users.role, users.center_id,
         users.phone_number, users.sms_sender_number, users.whatsapp_business_number,
         centers.name AS center_name, users.created_at
  FROM users
  LEFT JOIN centers ON centers.id = users.center_id
`;

const normalizeCenterName = (name) => (name || "").trim();

let userRoleConstraintReady = false;

const ensureUserRoleConstraint = async () => {
  if (userRoleConstraintReady) return;
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50)");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_sender_number VARCHAR(50)");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_business_number VARCHAR(50)");
  await query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
  await query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'VALIDATION', 'AGENT'))
  `);
  userRoleConstraintReady = true;
};

const getAllUsers = async (viewer = null) => {
  await ensureUserRoleConstraint();
  const params = [];
  let where = "";

  if (["ADMIN", "SUPERVISOR", "VALIDATION"].includes(viewer?.role)) {
    params.push(viewer.center_id);
    where = "WHERE users.center_id = $1 AND users.role <> 'SUPER_ADMIN'";
  }

  const result = await query(
    `${USER_SELECT}
     ${where}
     ORDER BY users.created_at DESC`,
    params,
  );
  return result.rows;
};

const getCenters = async () => {
  const result = await query(
    "SELECT id, name, created_at FROM centers ORDER BY name ASC",
  );
  return result.rows;
};

const getOrCreateCenter = async (name) => {
  const centerName = normalizeCenterName(name);
  if (!centerName) {
    return null;
  }

  const result = await query(
    `INSERT INTO centers (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [centerName],
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  await ensureUserRoleConstraint();
  const result = await query(
    `SELECT users.*, centers.name AS center_name
     FROM users
     LEFT JOIN centers ON centers.id = users.center_id
     WHERE users.email = $1`,
    [email],
  );
  return result.rows[0];
};

const getUserById = async (id) => {
  await ensureUserRoleConstraint();
  const result = await query(
    `${USER_SELECT}
     WHERE users.id = $1`,
    [id],
  );
  return result.rows[0];
};

const createUser = async ({
  email,
  password,
  name,
  role = "AGENT",
  centerId = null,
  phoneNumber = "",
  smsSenderNumber = "",
  whatsappBusinessNumber = "",
}) => {
  await ensureUserRoleConstraint();
  const result = await query(
    `INSERT INTO users
      (email, password, name, role, center_id, phone_number, sms_sender_number, whatsapp_business_number, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING id`,
    [
      email,
      password,
      name,
      role,
      centerId,
      phoneNumber || null,
      smsSenderNumber || null,
      whatsappBusinessNumber || null,
    ],
  );
  return getUserById(result.rows[0].id);
};

const updateUser = async (
  id,
  {
    email,
    name,
    role,
    centerId = null,
    phoneNumber = "",
    smsSenderNumber = "",
    whatsappBusinessNumber = "",
  },
) => {
  await ensureUserRoleConstraint();
  const result = await query(
    `UPDATE users
     SET email = $1,
         name = $2,
         role = $3,
         center_id = $4,
         phone_number = $5,
         sms_sender_number = $6,
         whatsapp_business_number = $7
     WHERE id = $8
     RETURNING id`,
    [
      email,
      name,
      role,
      centerId,
      phoneNumber || null,
      smsSenderNumber || null,
      whatsappBusinessNumber || null,
      id,
    ],
  );
  if (!result.rows[0]) {
    return null;
  }
  return getUserById(result.rows[0].id);
};

const deleteUser = async (id) => {
  await query("DELETE FROM users WHERE id = $1", [id]);
};

const updateUserPassword = async (id, passwordHash) => {
  const result = await query(
    `UPDATE users
     SET password = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [passwordHash, id],
  );
  if (!result.rows[0]) {
    return null;
  }
  return getUserById(result.rows[0].id);
};

module.exports = {
  query,
  getAllUsers,
  getCenters,
  getOrCreateCenter,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
};
