#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes SQL migration scripts without needing PostgreSQL password
 * Usage: node db-migrate.js [script-name]
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname);

async function runMigration(scriptName) {
  const scriptPath = path.join(MIGRATIONS_DIR, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Script not found: ${scriptPath}`);
    process.exit(1);
  }

  console.log(`\n📋 Running migration: ${scriptName}\n`);
  
  try {
    const sqlContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Split by semicolons to handle multiple statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    let statementCount = 0;
    
    for (const statement of statements) {
      try {
        console.log(`⏳ Executing statement ${statementCount + 1}...`);
        const result = await pool.query(statement);
        statementCount++;
        
        // Log the result
        if (result.rows && result.rows.length > 0) {
          console.log('✅ Result:');
          console.table(result.rows);
        } else if (result.rowCount > 0) {
          console.log(`✅ Affected rows: ${result.rowCount}`);
        } else {
          console.log('✅ Statement executed');
        }
      } catch (err) {
        console.error(`❌ Error on statement ${statementCount + 1}:`, err.message);
        throw err;
      }
    }

    console.log(`\n✅ Migration completed successfully! (${statementCount} statements executed)\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('\nDetails:', err);
    process.exit(1);
  }
}

// Get script name from command line
const scriptName = process.argv[2];

if (!scriptName) {
  console.log('\n📖 Usage: node db-migrate.js <script-name>\n');
  console.log('Available scripts:');
  console.log('  - fix-center-assignment.sql');
  console.log('  - schema.sql');
  console.log('  - seed.sql');
  console.log('\nExample:');
  console.log('  node db-migrate.js fix-center-assignment.sql\n');
  process.exit(1);
}

runMigration(scriptName).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
