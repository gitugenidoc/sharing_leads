-- Seed data for Mutual Insurance Client Management System
-- Creates center, super admin, admin, and 100 commercial agents with proper assignments

-- Step 1: Create the center
INSERT INTO centers (name)
VALUES ('QuereCourtage')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Insert super admin (global access, no center)
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

-- Step 3: Insert admin for QuereCourtage
WITH center_info AS (
	SELECT id FROM centers WHERE name = 'QuereCourtage'
)
INSERT INTO users (email, name, password, role, center_id)
VALUES (
	'admin@securassure.fr',
	'Admin',
	'$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a',
	'ADMIN',
	(SELECT id FROM center_info)
)
ON CONFLICT (email) DO UPDATE SET
	name = EXCLUDED.name,
	role = 'ADMIN',
	center_id = (SELECT id FROM centers WHERE name = 'QuereCourtage');

-- Step 4: Insert 100 commercial agents with proper center assignment
WITH center_info AS (
	SELECT id FROM centers WHERE name = 'QuereCourtage'
),
commercial_data AS (
	SELECT 
		'commercial' || i || '@jechangemamutuelle.online' as email,
		'Commercial ' || i as name,
		'$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a' as password,
		'AGENT' as role,
		(SELECT id FROM center_info) as center_id
	FROM GENERATE_SERIES(1, 100) i
)
INSERT INTO users (email, name, password, role, center_id)
SELECT email, name, password, role, center_id
FROM commercial_data
ON CONFLICT (email) DO UPDATE SET
	name = EXCLUDED.name,
	role = 'AGENT',
	center_id = EXCLUDED.center_id;

