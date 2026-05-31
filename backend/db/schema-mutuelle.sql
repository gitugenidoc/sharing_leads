-- PostgreSQL Database Schema for Mutual Insurance Client Management System
-- Execute this file to set up the production database

-- Create centers table
CREATE TABLE IF NOT EXISTS centers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'AGENT' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'AGENT')),
  center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clients table
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

-- Create import logs table
CREATE TABLE IF NOT EXISTS import_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  imported_rows INTEGER NOT NULL,
  failed_rows INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_center_id ON users(center_id);
CREATE INDEX idx_clients_nom ON clients(nom);
CREATE INDEX idx_clients_prenom ON clients(prenom);
CREATE INDEX idx_clients_ville ON clients(ville);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX idx_clients_center_id ON clients(center_id);
CREATE INDEX idx_clients_created_at ON clients(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at
BEFORE UPDATE ON centers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON centers TO "lead_app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO "lead_app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO "lead_app_user";
GRANT SELECT, INSERT ON import_logs TO "lead_app_user";
GRANT SELECT, INSERT ON audit_logs TO "lead_app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "lead_app_user";
