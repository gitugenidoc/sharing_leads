CREATE TABLE IF NOT EXISTS centers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'AGENT' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'AGENT')),
  center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
  phone_number VARCHAR(50),
  sms_sender_number VARCHAR(50),
  whatsapp_business_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CLOSED')),
  source VARCHAR(50) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('WEBSITE', 'REFERRAL', 'EMAIL', 'IMPORT', 'MANUAL')),
  amount DECIMAL(10, 2) DEFAULT 0.00,
  notes TEXT,
  center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  cancellation_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_center_id ON leads(center_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_communication_messages_client_id ON communication_messages(client_id);
CREATE INDEX idx_communication_messages_channel ON communication_messages(channel);
CREATE INDEX idx_communication_messages_created_at ON communication_messages(created_at);
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

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at
BEFORE UPDATE ON centers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON centers TO "lead_app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO "lead_app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO "lead_app_user";
GRANT SELECT, INSERT ON import_logs TO "lead_app_user";
GRANT SELECT, INSERT ON audit_logs TO "lead_app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "lead_app_user";
