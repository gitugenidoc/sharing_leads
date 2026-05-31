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
      adresse2 VARCHAR(500),
      ville VARCHAR(255) NOT NULL,
      code_postal VARCHAR(10) NOT NULL,
      civilite VARCHAR(50),
      profession VARCHAR(255),
      tel_fixe VARCHAR(50),
      tel_gsm VARCHAR(50),
      email VARCHAR(255),
      tel_professionnel VARCHAR(50),
      date_naissance VARCHAR(50),
      date_naissance_conjoint VARCHAR(50),
      naissance_enfant_1 VARCHAR(50),
      naissance_enfant_2 VARCHAR(50),
      naissance_enfant_3 VARCHAR(50),
      regime_tns VARCHAR(255),
      regime VARCHAR(255),
      regime_conjoint VARCHAR(255),
      remboursement_frais TEXT,
      besoins_specifiques TEXT,
      assurance_date VARCHAR(100),
      deja_mutuelle VARCHAR(255),
      nom_mutuelle VARCHAR(255) NOT NULL,
      prix_mutuelle DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CLOSED')),
      notes TEXT,
      extra_data JSONB DEFAULT '{}'::jsonb,
      center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse2 VARCHAR(500)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS civilite VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_fixe VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_gsm VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_professionnel VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance_conjoint VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_1 VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_2 VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_3 VARCHAR(50)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_tns VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_conjoint VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS remboursement_frais TEXT");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS besoins_specifiques TEXT");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS assurance_date VARCHAR(100)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS deja_mutuelle VARCHAR(255)");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb");
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

const ensureSuperAdminOnly = async () => {
  const adminPassword = await bcrypt.hash("admin123", 10);

  await pool.query(
    `INSERT INTO users (email, name, password, role, center_id)
     VALUES ('admin@test.com', 'Super Admin', $1, 'SUPER_ADMIN', NULL)
     ON CONFLICT (email) DO UPDATE SET
      role = 'SUPER_ADMIN',
      center_id = EXCLUDED.center_id`,
    [adminPassword],
  );
};

const removeDemoData = async () => {
  const demoCenter = await pool.query("SELECT id FROM centers WHERE name = $1", [
    "Centre Demo",
  ]);
  const demoCenterId = demoCenter.rows[0]?.id;

  if (demoCenterId) {
    await pool.query("DELETE FROM clients WHERE center_id = $1", [demoCenterId]);
  }

  await pool.query(
    "DELETE FROM users WHERE email IN ('centre@test.com', 'agent1@test.com', 'agent2@test.com')",
  );

  if (demoCenterId) {
    await pool.query("DELETE FROM centers WHERE id = $1", [demoCenterId]);
  }
};

const migrate = async () => {
  try {
    await createTables();
    await removeDemoData();
    await ensureSuperAdminOnly();
    console.log("Database migration completed");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

migrate();
