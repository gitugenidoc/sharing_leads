-- Seed data for Mutual Insurance Client Management System
-- Keep the database clean with only one super admin account.

INSERT INTO users (email, name, password, role)
VALUES (
	'contact@jechangemamutuelle.online',
	'Super Admin',
	'$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a',
	'SUPER_ADMIN'
)
ON CONFLICT (email) DO UPDATE SET
	name = EXCLUDED.name,
	role = 'SUPER_ADMIN';
