const pool = require("../config/db");

// Query helper
const query = (text, params) => pool.query(text, params);

// Get all users
const getAllUsers = async () => {
  const result = await query(
    "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC",
  );
  return result.rows;
};

// Get user by email
const getUserByEmail = async (email) => {
  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0];
};

// Get user by ID
const getUserById = async (id) => {
  const result = await query(
    "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
};

// Create user
const createUser = async (email, password, name, role = "AGENT") => {
  const result = await query(
    "INSERT INTO users (email, password, name, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, name, role, created_at",
    [email, password, name, role],
  );
  return result.rows[0];
};

// Update user
const updateUser = async (id, name, role) => {
  const result = await query(
    "UPDATE users SET name = $1, role = $2 WHERE id = $3 RETURNING id, email, name, role, created_at",
    [name, role, id],
  );
  return result.rows[0];
};

// Delete user
const deleteUser = async (id) => {
  await query("DELETE FROM users WHERE id = $1", [id]);
};

module.exports = {
  query,
  getAllUsers,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
