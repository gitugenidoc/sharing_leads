# PostgreSQL Migration Guide

## Overview

This guide helps migrate from the JSON-based mock backend to a production PostgreSQL database.

## Prerequisites

- PostgreSQL 12+ installed
- PostgreSQL CLI tools (`psql`)
- Node.js + npm

## Step 1: Create Database and User

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE lead_management;

# Create application user
CREATE USER lead_app_user WITH PASSWORD 'secure_password_here';

# Grant permissions
GRANT CONNECT ON DATABASE lead_management TO lead_app_user;

# Exit psql
\q
```

## Step 2: Initialize Schema

Use the app migration script in Step 6. It creates the mutuelle schema and seeds initial data automatically.

## Step 3: Update Environment Variables

Create or update `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lead_management
DB_USER=lead_app_user
DB_PASSWORD=secure_password_here

# JWT
JWT_SECRET=your_super_secret_key_here

# Environment
NODE_ENV=production
PORT=5000
```

## Step 4: Install pg Package

The `pg` package is already in package.json, but ensure it's installed:

```bash
npm install
```

## Step 5: Update Backend Server

Switch from `server-mock.js` to `server.js` (which uses PostgreSQL):

```bash
# Update package.json start script to use production server
npm run start  # Uses backend/server.js instead of server-mock.js
```

## Step 6: Initialize Data with Migration Script

Run the migration script to convert existing data:

```bash
node backend/db/migrate.js
```

This script will:

- Connect to PostgreSQL
- Create the mutuelle tables (`users`, `clients`, `import_logs`, `audit_logs`)
- Seed initial users and sample clients
- Validate connections

## Step 7: Verify Connection

Test the API is working:

```bash
# Login test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'

# Get clients (with token from login response)
curl -X GET http://localhost:5000/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Connection refused

- Ensure PostgreSQL is running: `sudo service postgresql start` (Linux) or use PostgreSQL app (Mac)
- Check database credentials in `.env`

### Permission denied

- Verify user permissions: `GRANT ALL PRIVILEGES ON DATABASE lead_management TO lead_app_user;`

### Import functionality

The Excel import now validates against PostgreSQL schema:

- Required client fields: `nom`, `prenom`, `adresse`, `ville`, `code_postal`, `nom_mutuelle`, `prix_mutuelle`
- `code_postal` must use 5 digits
- Status must be a valid enum value

### Performance Tips

- Indexes are pre-created for common queries
- Use `psql` to monitor slow queries:
  ```sql
  SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC;
  ```

## Rollback to Mock Mode

If you need to go back to JSON storage:

```bash
npm run start:mock
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS (use reverse proxy like nginx)
- [ ] Configure CORS for production domain
- [ ] Set up automated backups
- [ ] Enable PostgreSQL connection pooling (use PgBouncer)
- [ ] Monitor logs and audit trails
- [ ] Rate limiting configured (5 login attempts, 100 API calls/min)
- [ ] File uploads limited to 5MB, Excel only
