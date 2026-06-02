-- Complete seed data for Lead Management System
-- Creates centers, super admin, admin, and commercial agents with proper center assignment

-- First, insert the center
INSERT INTO centers (name)
VALUES ('QuereCourtage')
ON CONFLICT (name) DO NOTHING;

-- Insert super admin (no center assigned - has global access)
INSERT INTO users (email, name, password, role, center_id)
VALUES (
  'contact@jechangemamutuelle.online',
  'Super Admin',
  '$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a',
  'SUPER_ADMIN',
  NULL
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'SUPER_ADMIN',
  center_id = NULL;

-- Get the QuereCourtage center_id and insert admin
WITH center_id AS (
  SELECT id FROM centers WHERE name = 'QuereCourtage'
)
INSERT INTO users (email, name, password, role, center_id)
VALUES (
  'admin@securassure.fr',
  'Admin',
  '$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a',
  'ADMIN',
  (SELECT id FROM center_id)
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'ADMIN',
  center_id = (SELECT id FROM centers WHERE name = 'QuereCourtage');

-- Insert 100 commercial agents with proper center assignment
-- Using GENERATE_SERIES for bulk creation
WITH center_id AS (
  SELECT id FROM centers WHERE name = 'QuereCourtage'
),
commercial_agents AS (
  SELECT 
    'commercial' || i || '@jechangemamutuelle.online' as email,
    'Commercial Agent ' || i as name,
    '$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a' as password,
    'AGENT' as role,
    (SELECT id FROM center_id) as center_id
  FROM GENERATE_SERIES(1, 100) i
)
INSERT INTO users (email, name, password, role, center_id)
SELECT email, name, password, role, center_id
FROM commercial_agents
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'AGENT',
  center_id = EXCLUDED.center_id;

-- Verify the results
SELECT 'Centers' as category, COUNT(*) as count FROM centers
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Super Admins', COUNT(*) FROM users WHERE role = 'SUPER_ADMIN'
UNION ALL
SELECT 'Admins', COUNT(*) FROM users WHERE role = 'ADMIN'
UNION ALL
SELECT 'Agents', COUNT(*) FROM users WHERE role = 'AGENT'
UNION ALL
SELECT 'Users with center_id', COUNT(*) FROM users WHERE center_id IS NOT NULL;
