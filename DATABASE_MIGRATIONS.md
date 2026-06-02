# Database Migrations - Node.js Solution

## ✅ No PostgreSQL Password Needed!

Use Node.js scripts to run migrations directly through your existing database connection.

## Quick Start

### Fix Center Assignment (For existing users)
```bash
npm run db:fix-center
```

### Initialize Complete Database
```bash
# 1. Create schema
npm run db:schema

# 2. Seed with data (100 commercial agents)
npm run db:seed
```

### Seed for Mutual Insurance
```bash
npm run db:seed:mutuelle
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run db:schema` | Create all tables and indexes |
| `npm run db:seed` | Insert super admin, admin, and 100 agents |
| `npm run db:seed:mutuelle` | Same as db:seed (for insurance system) |
| `npm run db:fix-center` | Fix existing users with center_id = 0 |
| `npm run db:migrate` | Run database migration setup (legacy) |
| `npm run db:reset` | Reset entire database (dangerous!) |

## How It Works

The `migrate-runner.js` script:
1. Uses the Node.js PostgreSQL client (`pg` package)
2. Connects using environment variables (no password prompt)
3. Reads SQL files and executes statements
4. Shows progress and results in real-time
5. Handles errors gracefully

## Environment Configuration

The script uses your existing database connection from `backend/config/db.js`:

```javascript
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'lead_db'
});
```

### Configure in `.env` file:
```
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lead_db
```

Or set environment variables:
```bash
$env:DB_PASSWORD = "your_password"
npm run db:fix-center
```

## Step-by-Step Setup

### 1. Start with fresh database
```bash
npm run db:schema
```
Output:
```
📋 Running migration: schema.sql
⏳ Executing statement 1...
✅ Statement executed
...
✅ Migration completed successfully! (12 statements executed)
```

### 2. Seed the database
```bash
npm run db:seed
```
Output:
```
📋 Running migration: seed.sql
⏳ Executing statement 1...
✅ Result:
┌────┬──────────┐
│ id │ name     │
├────┼──────────┤
│ 1  │ QuereCourtage │
└────┴──────────┘
...
✅ Migration completed successfully! (3 statements executed)
```

### 3. Verify the setup
```bash
# From Node.js REPL or script:
node -e "
const Lead = require('./backend/models/Lead');
const User = require('./backend/models/User');

(async () => {
  const users = await User.getAllUsers();
  console.log('Total users:', users.length);
  console.log('Admins:', users.filter(u => u.role === 'ADMIN').length);
  console.log('Agents:', users.filter(u => u.role === 'AGENT').length);
})();
"
```

## Troubleshooting

### "Error: connect ECONNREFUSED"
PostgreSQL is not running. Start it:
```bash
# Windows
Get-Service PostgreSQL* | Start-Service

# Or check Services manually
```

### "error: password authentication failed"
Set the correct password:
```bash
$env:DB_PASSWORD = "your_actual_password"
npm run db:fix-center
```

### "error: relation 'users' does not exist"
Run schema first:
```bash
npm run db:schema
npm run db:seed
```

### "error: database 'lead_db' does not exist"
Create the database:
```bash
# From PostgreSQL command line or via script:
node -e "
const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: 'xxx' });
client.connect();
client.query('CREATE DATABASE lead_db;', (err) => {
  if (err) console.error(err);
  else console.log('Database created!');
  client.end();
});
"
```

## Manual Script Execution

If you need to run a custom SQL file:

```bash
node backend/db/migrate-runner.js your-script-name.sql
```

Example:
```bash
node backend/db/migrate-runner.js fix-center-assignment.sql
```

## Direct PostgreSQL Access (Optional)

If you prefer using psql directly with password file:

1. Create `pgpass.conf`:
   - **Windows:** `%APPDATA%\postgresql\pgpass.conf`
   - **Linux:** `~/.pgpass`

2. Add credentials:
   ```
   localhost:5432:lead_db:postgres:your_password
   ```

3. Make read-only (Linux only):
   ```bash
   chmod 600 ~/.pgpass
   ```

4. Use psql without password:
   ```bash
   psql -U postgres -d lead_db -f backend/db/fix-center-assignment.sql
   ```

## Success Indicators

After running migrations, check:

```sql
-- Should return multiple entries
SELECT * FROM centers;

-- Should show 1 super admin, 1 admin, 100 agents
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Should all have center_id assigned
SELECT COUNT(*) FROM users WHERE center_id IS NOT NULL;
```

## API Test After Setup

```bash
# Start the server
npm start

# In another terminal, test the API
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```
