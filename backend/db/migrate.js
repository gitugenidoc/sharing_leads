const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS centers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'AGENT',
      center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      nom VARCHAR(255) NOT NULL,
      prenom VARCHAR(255) NOT NULL,
      adresse VARCHAR(500) NOT NULL,
      ville VARCHAR(255) NOT NULL,
      code_postal VARCHAR(10) NOT NULL,
      nom_mutuelle VARCHAR(255) NOT NULL,
      prix_mutuelle DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CLOSED')),
      notes TEXT,
      center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'AGENT'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES users(id),
      filename VARCHAR(255) NOT NULL,
      total_rows INTEGER NOT NULL,
      imported_rows INTEGER NOT NULL,
      failed_rows INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_users_center_id ON users(center_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_center_id ON clients(center_id)",
  );
  await pool.query("CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom)");
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_prenom ON clients(prenom)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_ville ON clients(ville)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
  );

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await pool.query("DROP TRIGGER IF EXISTS update_users_updated_at ON users");
  await pool.query(`
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);

  await pool.query("DROP TRIGGER IF EXISTS update_clients_updated_at ON clients");
  await pool.query(`
    CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);

  await pool.query("DROP TRIGGER IF EXISTS update_centers_updated_at ON centers");
  await pool.query(`
    CREATE TRIGGER update_centers_updated_at
    BEFORE UPDATE ON centers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

const seedData = async () => {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const agentPassword = await bcrypt.hash("agent123", 10);

  const centerResult = await pool.query(
    `INSERT INTO centers (name)
     VALUES ('Centre Demo')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const demoCenterId = centerResult.rows[0].id;

  await pool.query(
    `INSERT INTO users (email, name, password, role, center_id)
     VALUES
      ('admin@test.com', 'Super Admin', $1, 'SUPER_ADMIN', NULL),
      ('centre@test.com', 'Admin Centre Demo', $2, 'ADMIN', $4),
      ('agent1@test.com', 'Agent One', $3, 'AGENT', $4),
      ('agent2@test.com', 'Agent Two', $3, 'AGENT', $4)
     ON CONFLICT (email) DO UPDATE SET
      role = EXCLUDED.role,
      center_id = EXCLUDED.center_id`,
    [adminPassword, adminPassword, agentPassword, demoCenterId],
  );

  await pool.query(
    "UPDATE users SET center_id = $1 WHERE role = 'AGENT' AND center_id IS NULL",
    [demoCenterId],
  );
  await pool.query(
    "UPDATE users SET role = 'SUPER_ADMIN', center_id = NULL WHERE email = 'admin@test.com'",
  );

  const count = await pool.query("SELECT COUNT(*) FROM clients");
  if (parseInt(count.rows[0].count, 10) > 0) {
    await pool.query("UPDATE clients SET center_id = $1 WHERE center_id IS NULL", [
      demoCenterId,
    ]);
    return;
  }

  const agentIds = await pool.query(
    "SELECT email, id FROM users WHERE email IN ('agent1@test.com', 'agent2@test.com')",
  );
  const agentIdByEmail = Object.fromEntries(
    agentIds.rows.map((row) => [row.email, row.id]),
  );
  const agent1Id = agentIdByEmail["agent1@test.com"];
  const agent2Id = agentIdByEmail["agent2@test.com"];

  await pool.query(`
    INSERT INTO clients (nom, prenom, adresse, ville, code_postal, nom_mutuelle, prix_mutuelle, status, assigned_to, center_id, notes)
    VALUES
      ('Martin', 'Jean', '123 Rue de la Paix', 'Paris', '75001', 'Mutuelle France', 45.50, 'NEW', $2, $1, 'Client prospection'),
      ('Dupont', 'Marie', '456 Avenue du Chateau', 'Lyon', '69000', 'Santeplus', 52.00, 'CONTACTED', $2, $1, 'Interesse par formule premium'),
      ('Bernard', 'Pierre', '789 Boulevard de la Mer', 'Marseille', '13000', 'Mutuelle Mediterranee', 38.75, 'INTERESTED', $3, $1, 'Appel planifie'),
      ('Thomas', 'Sophie', '321 Rue de la Gare', 'Toulouse', '31000', 'MGEN', 42.00, 'QUALIFIED', $3, $1, 'Visite client confirmee'),
      ('Robert', 'Luc', '654 Chemin du Moulin', 'Bordeaux', '33000', 'Mutuelle Aquitaine', 48.25, 'CLOSED', $2, $1, 'Contrat signe'),
      ('Richard', 'Anne', '987 Place de la Liberte', 'Nice', '06000', 'Allianz Mutuelle', 55.00, 'NEW', NULL, $1, 'En attente d assignation'),
      ('Leclerc', 'Francois', '111 Avenue des Champs', 'Lille', '59000', 'Mutuelle du Nord', 43.50, 'CONTACTED', $2, $1, 'Deuxieme relance'),
      ('Moreau', 'Isabelle', '222 Rue des Fleurs', 'Strasbourg', '67000', 'Santecarpe', 50.00, 'INTERESTED', $3, $1, 'Documentation envoyee'),
      ('Simon', 'Claude', '333 Boulevard Central', 'Montpellier', '34000', 'Mutuelle Occitanie', 41.00, 'QUALIFIED', $2, $1, 'Rendez-vous programme'),
      ('Laurent', 'Nathalie', '444 Chemin des Roses', 'Rennes', '35000', 'Mutuelle Bretagne', 44.75, 'NEW', $3, $1, 'Lead chaud')
  `, [demoCenterId, agent1Id, agent2Id]);
};

const migrate = async () => {
  try {
    await createTables();
    await seedData();
    console.log("Database migration and seed completed");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

migrate();
