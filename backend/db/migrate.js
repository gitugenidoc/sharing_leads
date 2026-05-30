const pool = require("../config/db");

// Create tables
const createTables = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'AGENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create leads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'NEW',
        source VARCHAR(100) DEFAULT 'UNKNOWN',
        amount DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create lead_assignments table (for history)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_assignments (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unassigned_at TIMESTAMP
      );
    `);

    // Create indexes for performance
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    );

    console.log("✓ Database tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
};

// Run migrations
createTables()
  .then(() => {
    console.log("✓ Migrations completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
