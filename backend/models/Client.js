const pool = require("../config/db");

const getAllClients = async (offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM clients ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return result.rows;
};

const getClientsCount = async () => {
  const result = await pool.query("SELECT COUNT(*) FROM clients");
  return parseInt(result.rows[0].count, 10);
};

const getUserClients = async (userId, offset = 0, limit = 100) => {
  const result = await pool.query(
    "SELECT * FROM clients WHERE assigned_to = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset],
  );
  return result.rows;
};

const getUserClientsCount = async (userId) => {
  const result = await pool.query(
    "SELECT COUNT(*) FROM clients WHERE assigned_to = $1",
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
};

const getClientById = async (id) => {
  const result = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
  return result.rows[0];
};

const createClient = async (clientData) => {
  const {
    nom,
    prenom,
    adresse,
    ville,
    code_postal,
    nom_mutuelle,
    prix_mutuelle,
    status,
    notes,
    assigned_to,
  } = clientData;

  const result = await pool.query(
    `INSERT INTO clients
      (nom, prenom, adresse, ville, code_postal, nom_mutuelle, prix_mutuelle, status, notes, assigned_to, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     RETURNING *`,
    [
      nom,
      prenom,
      adresse,
      ville,
      code_postal,
      nom_mutuelle,
      prix_mutuelle,
      status || "NEW",
      notes || "",
      assigned_to || null,
    ],
  );
  return result.rows[0];
};

const updateClient = async (id, clientData) => {
  const {
    nom,
    prenom,
    adresse,
    ville,
    code_postal,
    nom_mutuelle,
    prix_mutuelle,
    status,
    notes,
    assigned_to,
  } = clientData;

  const result = await pool.query(
    `UPDATE clients SET
      nom = COALESCE($1, nom),
      prenom = COALESCE($2, prenom),
      adresse = COALESCE($3, adresse),
      ville = COALESCE($4, ville),
      code_postal = COALESCE($5, code_postal),
      nom_mutuelle = COALESCE($6, nom_mutuelle),
      prix_mutuelle = COALESCE($7, prix_mutuelle),
      status = COALESCE($8, status),
      notes = COALESCE($9, notes),
      assigned_to = COALESCE($10, assigned_to),
      updated_at = NOW()
     WHERE id = $11
     RETURNING *`,
    [
      nom,
      prenom,
      adresse,
      ville,
      code_postal,
      nom_mutuelle,
      prix_mutuelle,
      status,
      notes,
      assigned_to,
      id,
    ],
  );
  return result.rows[0];
};

const deleteClient = async (id) => {
  await pool.query("DELETE FROM clients WHERE id = $1", [id]);
};

const assignClient = async (clientId, userId) => {
  const result = await pool.query(
    "UPDATE clients SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [userId, clientId],
  );
  return result.rows[0];
};

const searchClients = async (query, offset = 0, limit = 100) => {
  const result = await pool.query(
    `SELECT * FROM clients
     WHERE nom ILIKE $1
        OR prenom ILIKE $1
        OR ville ILIKE $1
        OR code_postal ILIKE $1
        OR nom_mutuelle ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [`%${query}%`, limit, offset],
  );
  return result.rows;
};

const bulkInsertClients = async (clients) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of clients) {
      await client.query(
        `INSERT INTO clients
          (nom, prenom, adresse, ville, code_postal, nom_mutuelle, prix_mutuelle, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          row.nom,
          row.prenom,
          row.adresse,
          row.ville,
          row.code_postal,
          row.nom_mutuelle,
          row.prix_mutuelle,
          row.status || "NEW",
          row.notes || "",
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

module.exports = {
  getAllClients,
  getClientsCount,
  getUserClients,
  getUserClientsCount,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  assignClient,
  searchClients,
  bulkInsertClients,
};
