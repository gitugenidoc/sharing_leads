-- Seed data for Mutual Insurance Client Management System

-- Insert test users
INSERT INTO users (email, name, password, role) VALUES
('admin@test.com', 'Admin User', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'ADMIN'),
('agent1@test.com', 'Agent One', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'AGENT'),
('agent2@test.com', 'Agent Two', '$2a$10$N9qo8uLOickgx2ZMRZoHyuPHZRE8LrDqQBQrI5g2VnKuOOGHEfvLm', 'AGENT')
ON CONFLICT (email) DO NOTHING;

-- Insert sample clients
INSERT INTO clients (nom, prenom, adresse, ville, code_postal, nom_mutuelle, prix_mutuelle, status, assigned_to, notes)
VALUES
('Martin', 'Jean', '123 Rue de la Paix', 'Paris', '75001', 'Mutuelle France', 45.50, 'NEW', 2, 'Client prospection'),
('Dupont', 'Marie', '456 Avenue du Château', 'Lyon', '69000', 'Santéplus', 52.00, 'CONTACTED', 2, 'Intéressé par formule premium'),
('Bernard', 'Pierre', '789 Boulevard de la Mer', 'Marseille', '13000', 'Mutuelle Méditerranée', 38.75, 'INTERESTED', 3, 'Appel planifié'),
('Thomas', 'Sophie', '321 Rue de la Gare', 'Toulouse', '31000', 'MGEN', 42.00, 'QUALIFIED', 3, 'Visite client confirmée'),
('Robert', 'Luc', '654 Chemin du Moulin', 'Bordeaux', '33000', 'Mutuelle Aquitaine', 48.25, 'CLOSED', 2, 'Contrat signé'),
('Richard', 'Anne', '987 Place de la Liberté', 'Nice', '06000', 'Allianz Mutuelle', 55.00, 'NEW', NULL, 'En attente d''assignation'),
('Leclerc', 'François', '111 Avenue des Champs', 'Lille', '59000', 'Mutuelle du Nord', 43.50, 'CONTACTED', 2, 'Deuxième relance'),
('Moreau', 'Isabelle', '222 Rue des Fleurs', 'Strasbourg', '67000', 'Santécarpe', 50.00, 'INTERESTED', 3, 'Documentation envoyée'),
('Simon', 'Claude', '333 Boulevard Central', 'Montpellier', '34000', 'Mutuelle Occitanie', 41.00, 'QUALIFIED', 2, 'Rendez-vous programmé'),
('Laurent', 'Nathalie', '444 Chemin des Roses', 'Rennes', '35000', 'Mutuelle Bretagne', 44.75, 'NEW', 3, 'Lead chaud');
