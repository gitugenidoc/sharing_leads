# PostgreSQL Database Migration Guide

## Setup PostgreSQL Access

### Option 1: Configure PostgreSQL Password File (Recommended)

Create a `.pgpass` file in your home directory to store credentials:

**Windows:** `C:\Users\[YourUsername]\AppData\postgresql\pgpass.conf`

```
localhost:5432:lead_db:postgres:your_password_here
```

Then you can run psql without entering password:

```powershell
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
& $psqlPath -U postgres -d lead_db -f backend/db/fix-center-assignment.sql
```

### Option 2: Use the Helper Script

```powershell
# First time - enter your password when prompted
.\db-sql.ps1 -ScriptPath "backend/db/fix-center-assignment.sql" -Password "your_postgres_password"
```

### Option 3: Set PGPASSWORD Environment Variable

```powershell
$env:PGPASSWORD = "your_postgres_password"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d lead_db -f backend/db/fix-center-assignment.sql
$env:PGPASSWORD = ""  # Clear password after use
```

## Available Database Scripts

### Migration Scripts
- `backend/db/fix-center-assignment.sql` - Fix existing users with center_id = 0

### Seed Scripts
- `backend/db/schema.sql` - Create all tables and indexes
- `backend/db/seed.sql` - Insert 1 admin + 100 commercial agents
- `backend/db/seed-mutuelle.sql` - Same as seed.sql (for mutual insurance DB)

## Quick Start

1. **Find PostgreSQL Installation:**
   ```powershell
   Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter 'psql.exe'
   ```

2. **Create PostgreSQL Password File:**
   - Location: `C:\Users\[YourUsername]\AppData\postgresql\pgpass.conf`
   - Format: `hostname:port:database:username:password`
   - Permissions: Must be read-only (chmod 600 on Linux, no special perms on Windows)

3. **Run Migration:**
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d lead_db -f backend/db/fix-center-assignment.sql
   ```

4. **Verify Changes:**
   ```powershell
   # Login to PostgreSQL
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d lead_db
   
   # In psql:
   SELECT role, COUNT(*) FROM users GROUP BY role;
   SELECT email, role, center_id FROM users WHERE role = 'AGENT' LIMIT 5;
   ```

## Troubleshooting

### "psql is not recognized"
Add PostgreSQL to PATH permanently:
1. Open Environment Variables (Win+R → `sysdm.cpl`)
2. Add `C:\Program Files\PostgreSQL\18\bin` to PATH
3. Restart PowerShell

### "Password authentication failed"
- Verify your PostgreSQL password is correct
- Check if user `postgres` exists: `psql -U postgres -l`
- Reset PostgreSQL password if forgotten

### "Database lead_db does not exist"
Create the database first:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE lead_db;"
```

Then run the schema script:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d lead_db -f backend/db/schema.sql
```

## PowerShell Helper Script

Use the included `db-sql.ps1` script:

```powershell
# Run with password
.\db-sql.ps1 -ScriptPath "backend/db/schema.sql" -Password "your_password"

# Or with pgpass file configured
.\db-sql.ps1 -ScriptPath "backend/db/seed.sql"
```
