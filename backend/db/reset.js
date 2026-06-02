/**
 * reset.js — Réinitialisation complète de la base de données
 *
 * Ce script :
 *   1. Supprime TOUTES les données (clients, centres, users sauf super admin,
 *      logs, historique, emails)
 *   2. Applique la migration complète du schéma
 *   3. Recrée uniquement le compte SUPER_ADMIN
 *
 * Usage : node backend/db/reset.js
 */

const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const SUPER_ADMIN_EMAIL = "contact@jechangemamutuelle.online";
const SUPER_ADMIN_NAME  = "Super Admin";
const SUPER_ADMIN_PASS  = "admin123"; // à changer en production

async function applySchema() {
  console.log("📐 Application du schéma...");

  // ---------- TABLES ----------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS centers (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(255) UNIQUE NOT NULL,
      name       VARCHAR(255) NOT NULL,
      password   VARCHAR(255) NOT NULL,
      role       VARCHAR(50) NOT NULL DEFAULT 'AGENT',
      center_id  INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id                      SERIAL PRIMARY KEY,
      nom                     VARCHAR(255) NOT NULL,
      prenom                  VARCHAR(255) NOT NULL,
      adresse                 VARCHAR(500) NOT NULL,
      adresse2                VARCHAR(500),
      ville                   VARCHAR(255) NOT NULL,
      code_postal             VARCHAR(10) NOT NULL,
      civilite                VARCHAR(50),
      profession              VARCHAR(255),
      tel_fixe                VARCHAR(50),
      tel_gsm                 VARCHAR(50),
      email                   VARCHAR(255),
      tel_professionnel       VARCHAR(50),
      date_naissance          VARCHAR(50),
      date_naissance_conjoint VARCHAR(50),
      naissance_enfant_1      VARCHAR(50),
      naissance_enfant_2      VARCHAR(50),
      naissance_enfant_3      VARCHAR(50),
      regime_tns              VARCHAR(255),
      regime                  VARCHAR(255),
      regime_conjoint         VARCHAR(255),
      remboursement_frais     TEXT,
      besoins_specifiques     TEXT,
      assurance_date          VARCHAR(100),
      deja_mutuelle           VARCHAR(255),
      nom_mutuelle            VARCHAR(255) NOT NULL DEFAULT 'Non renseignee',
      prix_mutuelle           DECIMAL(10,2) NOT NULL DEFAULT 0,
      status                  VARCHAR(50) NOT NULL DEFAULT 'NEW',
      notes                   TEXT,
      reminder_at             TIMESTAMP,
      reminder_priority       VARCHAR(20) DEFAULT 'NORMAL',
      reminder_comment        TEXT,
      nlp_score               INTEGER DEFAULT 0,
      nlp_label               VARCHAR(30) DEFAULT 'INCOMPLET',
      last_contacted_at       TIMESTAMP,
      last_action_at          TIMESTAMP,
      assigned_at             TIMESTAMP,
      assignment_expires_at   TIMESTAMP,
      extra_data              JSONB DEFAULT '{}'::jsonb,
      center_id               INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      assigned_to             INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id            SERIAL PRIMARY KEY,
      admin_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      filename      VARCHAR(255) NOT NULL,
      total_rows    INTEGER NOT NULL,
      imported_rows INTEGER NOT NULL,
      failed_rows   INTEGER NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action      VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id   INTEGER NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mail_logs (
      id               SERIAL PRIMARY KEY,
      sender_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_id        INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      template_id      VARCHAR(100),
      recipient_email  VARCHAR(255) NOT NULL,
      recipient_name   VARCHAR(255),
      subject          VARCHAR(255) NOT NULL,
      body             TEXT NOT NULL,
      status           VARCHAR(50) DEFAULT 'SENT',
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_history (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     VARCHAR(80) NOT NULL,
      old_value  JSONB,
      new_value  JSONB,
      note       TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---------- COLONNES OPTIONNELLES (ADD IF NOT EXISTS) ----------
  const optionalCols = [
    ["users",   "center_id",               "INTEGER REFERENCES centers(id) ON DELETE SET NULL"],
    ["clients", "adresse2",                "VARCHAR(500)"],
    ["clients", "civilite",                "VARCHAR(50)"],
    ["clients", "profession",              "VARCHAR(255)"],
    ["clients", "tel_fixe",               "VARCHAR(50)"],
    ["clients", "tel_gsm",                "VARCHAR(50)"],
    ["clients", "email",                  "VARCHAR(255)"],
    ["clients", "tel_professionnel",      "VARCHAR(50)"],
    ["clients", "date_naissance",         "VARCHAR(50)"],
    ["clients", "date_naissance_conjoint","VARCHAR(50)"],
    ["clients", "naissance_enfant_1",     "VARCHAR(50)"],
    ["clients", "naissance_enfant_2",     "VARCHAR(50)"],
    ["clients", "naissance_enfant_3",     "VARCHAR(50)"],
    ["clients", "regime_tns",             "VARCHAR(255)"],
    ["clients", "regime",                 "VARCHAR(255)"],
    ["clients", "regime_conjoint",        "VARCHAR(255)"],
    ["clients", "remboursement_frais",    "TEXT"],
    ["clients", "besoins_specifiques",    "TEXT"],
    ["clients", "assurance_date",         "VARCHAR(100)"],
    ["clients", "deja_mutuelle",          "VARCHAR(255)"],
    ["clients", "extra_data",             "JSONB DEFAULT '{}'::jsonb"],
    ["clients", "assigned_at",            "TIMESTAMP"],
    ["clients", "assignment_expires_at",  "TIMESTAMP"],
    ["clients", "reminder_at",            "TIMESTAMP"],
    ["clients", "reminder_priority",      "VARCHAR(20) DEFAULT 'NORMAL'"],
    ["clients", "reminder_comment",       "TEXT"],
    ["clients", "nlp_score",              "INTEGER DEFAULT 0"],
    ["clients", "nlp_label",              "VARCHAR(30) DEFAULT 'INCOMPLET'"],
    ["clients", "last_contacted_at",      "TIMESTAMP"],
    ["clients", "last_action_at",         "TIMESTAMP"],
    ["mail_logs", "client_id",            "INTEGER REFERENCES clients(id) ON DELETE SET NULL"],
    ["mail_logs", "template_id",          "VARCHAR(100)"],
  ];
  for (const [table, col, def] of optionalCols) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
  }

  // ---------- CONTRAINTES ----------
  await pool.query("ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check");
  await pool.query(`
    ALTER TABLE clients ADD CONSTRAINT clients_status_check
    CHECK (status IN (
      'NEW','TO_CALL','UNREACHABLE','CALLBACK_SCHEDULED',
      'QUOTE_SENT','INTERESTED','REFUSED','SIGNED','LOST',
      'CONTACTED','QUALIFIED','CLOSED'
    ))
  `);

  await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
  await pool.query(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('SUPER_ADMIN','ADMIN','AGENT'))
  `);

  // ---------- INDEX ----------
  const indexes = [
    ["idx_users_email",                "users(email)"],
    ["idx_users_center_id",            "users(center_id)"],
    ["idx_clients_center_id",          "clients(center_id)"],
    ["idx_clients_nom",                "clients(nom)"],
    ["idx_clients_prenom",             "clients(prenom)"],
    ["idx_clients_ville",              "clients(ville)"],
    ["idx_clients_status",             "clients(status)"],
    ["idx_clients_assigned_to",        "clients(assigned_to)"],
    ["idx_clients_created_at",         "clients(created_at)"],
    ["idx_clients_reminder_at",        "clients(reminder_at)"],
    ["idx_clients_nlp_label",          "clients(nlp_label)"],
    ["idx_audit_logs_user_id",         "audit_logs(user_id)"],
    ["idx_audit_logs_created_at",      "audit_logs(created_at)"],
    ["idx_mail_logs_sender_id",        "mail_logs(sender_id)"],
    ["idx_mail_logs_client_id",        "mail_logs(client_id)"],
    ["idx_mail_logs_created_at",       "mail_logs(created_at)"],
    ["idx_client_history_client_id",   "client_history(client_id)"],
    ["idx_client_history_created_at",  "client_history(created_at)"],
  ];
  for (const [name, def] of indexes) {
    await pool.query(`CREATE INDEX IF NOT EXISTS ${name} ON ${def}`);
  }

  // ---------- TRIGGERS updated_at ----------
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
    $$ language 'plpgsql'
  `);

  for (const table of ["users", "clients", "centers"]) {
    await pool.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
    await pool.query(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  console.log("   ✅ Schéma OK");
}

async function purgeAllData() {
  console.log("🗑️  Suppression de toutes les données...");

  // Respecter l'ordre des clés étrangères
  await pool.query("DELETE FROM client_history");
  await pool.query("DELETE FROM audit_logs");
  await pool.query("DELETE FROM mail_logs");
  await pool.query("DELETE FROM import_logs");
  await pool.query("DELETE FROM clients");
  // Supprimer tous les users SAUF le super admin (on le recréera juste après)
  await pool.query(`DELETE FROM users WHERE email <> $1`, [SUPER_ADMIN_EMAIL]);
  // Supprimer les centres (plus de FK vers users maintenant)
  await pool.query("DELETE FROM centers");
  // Supprimer aussi le super admin pour le recréer proprement
  await pool.query("DELETE FROM users");

  // Réinitialiser les séquences pour repartir de 1
  await pool.query("SELECT setval(pg_get_serial_sequence('users','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('clients','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('centers','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('import_logs','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('audit_logs','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('mail_logs','id'), 1, false)");
  await pool.query("SELECT setval(pg_get_serial_sequence('client_history','id'), 1, false)");

  console.log("   ✅ Données purgées, séquences réinitialisées");
}

async function createSuperAdmin() {
  console.log("👤 Création du compte Super Admin...");

  const hash = await bcrypt.hash(SUPER_ADMIN_PASS, 12);
  await pool.query(
    `INSERT INTO users (email, name, password, role, center_id)
     VALUES ($1, $2, $3, 'SUPER_ADMIN', NULL)
     ON CONFLICT (email) DO UPDATE SET
       name      = EXCLUDED.name,
       password  = EXCLUDED.password,
       role      = 'SUPER_ADMIN',
       center_id = NULL`,
    [SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, hash]
  );

  console.log(`   ✅ Super Admin créé`);
  console.log(`   📧 Email    : ${SUPER_ADMIN_EMAIL}`);
  console.log(`   🔑 Password : ${SUPER_ADMIN_PASS}`);
}

async function verifyReset() {
  console.log("🔍 Vérification...");
  const users   = await pool.query("SELECT COUNT(*) FROM users");
  const clients = await pool.query("SELECT COUNT(*) FROM clients");
  const centers = await pool.query("SELECT COUNT(*) FROM centers");
  const logs    = await pool.query("SELECT COUNT(*) FROM import_logs");

  console.log(`   Users   : ${users.rows[0].count} (attendu: 1)`);
  console.log(`   Clients : ${clients.rows[0].count} (attendu: 0)`);
  console.log(`   Centres : ${centers.rows[0].count} (attendu: 0)`);
  console.log(`   Imports : ${logs.rows[0].count} (attendu: 0)`);
}

async function reset() {
  console.log("\n🚀 === RÉINITIALISATION DE LA BASE DE DONNÉES ===\n");
  try {
    await applySchema();
    await purgeAllData();
    await createSuperAdmin();
    await verifyReset();
    console.log("\n✅ Réinitialisation terminée avec succès !\n");
  } catch (err) {
    console.error("\n❌ Erreur lors de la réinitialisation :", err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

reset();
