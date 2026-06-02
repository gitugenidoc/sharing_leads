# Scripts de correction pour center_id

## Problème
Les 100 utilisateurs commerciaux avaient `center_id = 0` au lieu d'être assignés au centre "QuereCourtage".

## Solutions

### Option 1: Exécuter le script de migration (RECOMMENDED)
Pour corriger les utilisateurs existants avec center_id = 0:

```bash
psql -U postgres -d lead_db -f backend/db/fix-center-assignment.sql
```

Ce script:
- ✅ Crée le centre "QuereCourtage" s'il n'existe pas
- ✅ Met à jour tous les utilisateurs ADMIN/AGENT avec center_id = 0 ou NULL
- ✅ Affiche un rapport de vérification

### Option 2: Réinitialiser avec seed complet
Pour réinitialiser complètement la base de données avec tous les utilisateurs correctement assignés:

```bash
# Drop et recreate la base
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS lead_db;"
psql -U postgres -d postgres -c "CREATE DATABASE lead_db;"

# Exécuter le schéma et le seed complet
psql -U postgres -d lead_db -f backend/db/schema.sql
psql -U postgres -d lead_db -f backend/db/seed.sql  # Contains 100 commercial agents now
```

## Contenu des scripts

### fix-center-assignment.sql
- Corrige les utilisateurs existants avec center_id = 0
- Crée le centre "QuereCourtage" s'il n'existe pas
- Affiche un rapport détaillé

### seed.sql et seed-mutuelle.sql (UPDATED)
Maintenant inclus:
- 1 centre "QuereCourtage"
- 1 SUPER_ADMIN (contact@jechangemamutuelle.online)
- 1 ADMIN (admin@securassure.fr) - assigné à QuereCourtage
- 100 AGENTS (commercial1 à commercial100) - tous assignés à QuereCourtage

### seed-complete.sql
Version alternative avec les mêmes données

## Utilisation dans migrate.js

Le fichier `backend/db/migrate.js` devrait utiliser ces seeds:

```javascript
// Drop existing tables
await client.query('DROP TABLE IF EXISTS audit_logs CASCADE');
await client.query('DROP TABLE IF EXISTS import_logs CASCADE');
await client.query('DROP TABLE IF EXISTS leads CASCADE');
await client.query('DROP TABLE IF EXISTS users CASCADE');
await client.query('DROP TABLE IF EXISTS centers CASCADE');

// Create schema
const schema = fs.readFileSync('./db/schema.sql', 'utf8');
await client.query(schema);

// Seed data
const seed = fs.readFileSync('./db/seed.sql', 'utf8');
await client.query(seed);
```

## Vérification

Après exécution, vérifiez:

```sql
-- Voir les centres
SELECT * FROM centers;

-- Voir les utilisateurs par rôle
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Voir les utilisateurs avec leur centre
SELECT u.email, u.role, c.name as center 
FROM users u 
LEFT JOIN centers c ON u.center_id = c.id 
ORDER BY u.role, u.email;

-- Vérifier que les 100 commerciaux ont le bon center_id
SELECT COUNT(*) FROM users 
WHERE role = 'AGENT' AND center_id IS NOT NULL;
```

## Mots de passe par défaut
Tous les utilisateurs utilisent le mot de passe hashé par défaut:
- Correspond à: `password123`
- Hash bcrypt: `$2a$10$BX29kyORsa8IwVj3zN4nJu3BkOH8j5osSV95O7TyVHo0z6ccbzm2a`
