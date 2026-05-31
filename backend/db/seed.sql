-- Seed data for Lead Management System

-- Insert test users
INSERT INTO users (email, name, password, role) VALUES
('contact@jechangemamutuelle.online', 'Admin User', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'ADMIN'),
('agent1@test.com', 'Agent One', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'AGENT'),
('agent2@test.com', 'Agent Two', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'AGENT')
ON CONFLICT (email) DO NOTHING;

-- Insert sample leads (100 leads)
INSERT INTO leads (name, email, phone, status, source, amount, assigned_to, notes)
SELECT
  'Lead ' || i,
  'lead' || i || '@example.com',
  '555-' || LPAD(i::text, 4, '0'),
  CASE WHEN i % 4 = 0 THEN 'NEW' WHEN i % 4 = 1 THEN 'CONTACTED' WHEN i % 4 = 2 THEN 'INTERESTED' ELSE 'QUALIFIED' END,
  'IMPORT',
  ROUND((RANDOM() * 100000)::numeric, 2),
  CASE WHEN i % 3 = 0 THEN 2 WHEN i % 3 = 1 THEN 3 ELSE NULL END,
  'Sample lead ' || i
FROM generate_series(1, 100) AS t(i);
