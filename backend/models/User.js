const pool = require("../config/db");

const query = (text, params) => pool.query(text, params);

const USER_SELECT = `
  SELECT users.id, users.email, users.name, users.role, users.center_id,
         centers.name AS center_name, users.created_at
  FROM users
  LEFT JOIN centers ON centers.id = users.center_id
`;

const normalizeCenterName = (name) => (name || "").trim();

const getAllUsers = async (viewer = null) => {
  const params = [];
  let where = "";

  if (viewer?.role === "ADMIN") {
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
}) => {
  const result = await query(
    `INSERT INTO users (email, password, name, role, center_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [email, password, name, role, centerId],
  );
  return getUserById(result.rows[0].id);
};

const updateUser = async (id, { email, name, role, centerId = null }) => {
  const result = await query(
    `UPDATE users
     SET email = $1, name = $2, role = $3, center_id = $4
     WHERE id = $5
     RETURNING id`,
    [email, name, role, centerId, id],
  );
  if (!result.rows[0]) {
    return null;
  }
  return getUserById(result.rows[0].id);
};

const deleteUser = async (id) => {
  await query("DELETE FROM users WHERE id = $1", [id]);
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
  deleteUser,
};
