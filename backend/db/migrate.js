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
      status VARCHAR(50) NOT NULL DEFAULT 'NEW',
      notes TEXT,
      reminder_at TIMESTAMP,
      reminder_priority VARCHAR(20) DEFAULT 'NORMAL',
      reminder_comment TEXT,
      nlp_score INTEGER DEFAULT 0,
      nlp_label VARCHAR(30) DEFAULT 'INCOMPLET',
      last_contacted_at TIMESTAMP,
      last_action_at TIMESTAMP,
      closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      closed_at TIMESTAMP,
      extra_data JSONB DEFAULT '{}'::jsonb,
      center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse2 VARCHAR(500)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS civilite VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_fixe VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_gsm VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS tel_professionnel VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance_conjoint VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_1 VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_2 VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS naissance_enfant_3 VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_tns VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_conjoint VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS remboursement_frais TEXT",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS besoins_specifiques TEXT",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS assurance_date VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS deja_mutuelle VARCHAR(255)",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS assignment_expires_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_priority VARCHAR(20) DEFAULT 'NORMAL'",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_comment TEXT",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS nlp_score INTEGER DEFAULT 0",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS nlp_label VARCHAR(30) DEFAULT 'INCOMPLET'",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
  );
  await pool.query(
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_sender_number VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_business_number VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check",
  );
  await pool.query(`
    ALTER TABLE clients
    ADD CONSTRAINT clients_status_check
    CHECK (status IN (
      'NEW',
      'TO_CALL',
      'UNREACHABLE',
      'CALLBACK_SCHEDULED',
      'QUOTE_SENT',
      'INTERESTED',
      'REFUSED',
      'SIGNED',
      'LOST',
      'CONTACTED',
      'QUALIFIED',
      'CLOSED'
    ))
  `);
  await pool.query(
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check",
  );
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'AGENT'))
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mail_logs (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      template_id VARCHAR(100),
      recipient_email VARCHAR(255) NOT NULL,
      recipient_name VARCHAR(255),
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'SENT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(
    "ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL",
  );
  await pool.query(
    "ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS template_id VARCHAR(100)",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
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
    );
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_users_center_id ON users(center_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_center_id ON clients(center_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom)",
  );
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
    "CREATE INDEX IF NOT EXISTS idx_clients_reminder_at ON clients(reminder_at)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_nlp_label ON clients(nlp_label)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_clients_closed_by ON clients(closed_by)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_mail_logs_sender_id ON mail_logs(sender_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_mail_logs_client_id ON mail_logs(client_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_mail_logs_created_at ON mail_logs(created_at)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_client_history_client_id ON client_history(client_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_client_history_created_at ON client_history(created_at)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_client_id ON communication_messages(client_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON communication_messages(channel)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_communication_messages_created_at ON communication_messages(created_at)",
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

  await pool.query(
    "DROP TRIGGER IF EXISTS update_clients_updated_at ON clients",
  );
  await pool.query(`
    CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);

  await pool.query(
    "DROP TRIGGER IF EXISTS update_centers_updated_at ON centers",
  );
  await pool.query(`
    CREATE TRIGGER update_centers_updated_at
    BEFORE UPDATE ON centers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

const SUPER_ADMIN_EMAIL = "contact@jechangemamutuelle.online";

const ensureSuperAdminOnly = async () => {
  const adminPassword = await bcrypt.hash("admin123", 10);

  // Update existing admin@test.com to new email if contact@jechangemamutuelle.online does not exist yet
  await pool.query(
    `UPDATE users 
     SET email = 'contact@jechangemamutuelle.online' 
     WHERE email = 'admin@test.com' 
     AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'contact@jechangemamutuelle.online')`,
  );

  await pool.query(
    `INSERT INTO users (email, name, password, role, center_id)
     VALUES ('contact@jechangemamutuelle.online', 'Super Admin', $1, 'SUPER_ADMIN', NULL)
     ON CONFLICT (email) DO UPDATE SET
      role = 'SUPER_ADMIN',
      center_id = EXCLUDED.center_id`,
    [adminPassword],
  );
};

const purgeToSuperAdminOnly = async () => {
  await pool.query("DELETE FROM communication_messages");
  await pool.query("DELETE FROM client_history");
  await pool.query("DELETE FROM audit_logs");
  await pool.query("DELETE FROM mail_logs");
  await pool.query("DELETE FROM import_logs");
  await pool.query("DELETE FROM clients");
  await pool.query("DELETE FROM users WHERE email <> $1", [SUPER_ADMIN_EMAIL]);
  await pool.query("DELETE FROM centers");
};

const migrate = async () => {
  try {
    await createTables();
    await ensureSuperAdminOnly();
    await purgeToSuperAdminOnly();
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
