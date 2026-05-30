const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Data files
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

// Middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend/public")));

// Initialize data files
function initializeDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    const admin = {
      id: 1,
      email: "admin@test.com",
      name: "Admin User",
      password: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const agent1 = {
      id: 2,
      email: "agent1@test.com",
      name: "Agent One",
      password: bcrypt.hashSync("agent123", 10),
      role: "AGENT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const agent2 = {
      id: 3,
      email: "agent2@test.com",
      name: "Agent Two",
      password: bcrypt.hashSync("agent123", 10),
      role: "AGENT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(
      USERS_FILE,
      JSON.stringify([admin, agent1, agent2], null, 2),
    );
  }

  if (!fs.existsSync(LEADS_FILE)) {
    const leads = [];
    for (let i = 1; i <= 100; i++) {
      leads.push({
        id: i,
        name: `Lead ${i}`,
        email: `lead${i}@example.com`,
        phone: `555-${String(i).padStart(4, "0")}`,
        status: ["NEW", "CONTACTED", "INTERESTED", "QUALIFIED"][
          Math.floor(Math.random() * 4)
        ],
        source: ["WEBSITE", "REFERRAL", "EMAIL", "IMPORT"][
          Math.floor(Math.random() * 4)
        ],
        amount: Math.round(Math.random() * 100000 * 100) / 100,
        notes: `Notes for lead ${i}`,
        assigned_to: i % 3 === 0 ? 2 : i % 3 === 1 ? 3 : null,
        created_at: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  }
}

// Helper functions
function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readLeads() {
  return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

// Middleware: Verify JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}

// Middleware: Check if admin
function isAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// Routes: Auth
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, role } = req.body;
  const users = readUsers();

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const newUser = {
    id: Math.max(...users.map((u) => u.id), 0) + 1,
    email,
    password: bcrypt.hashSync(password, 10),
    name,
    role: role || "AGENT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  res.json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// Routes: Users
app.get("/api/users", verifyToken, isAdmin, (req, res) => {
  const users = readUsers();
  const leads = readLeads();

  const result = users.map((u) => ({
    ...u,
    password: undefined,
    leads_count: leads.filter((l) => l.assigned_to === u.id).length,
  }));

  res.json(result);
});

app.post("/api/users", verifyToken, isAdmin, (req, res) => {
  const { email, name, role } = req.body;
  const users = readUsers();

  const newUser = {
    id: Math.max(...users.map((u) => u.id), 0) + 1,
    email,
    name,
    role: role || "AGENT",
    password: bcrypt.hashSync("defaultPass123", 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  res.json({ ...newUser, password: undefined });
});

app.delete("/api/users/:id", verifyToken, isAdmin, (req, res) => {
  let users = readUsers();
  users = users.filter((u) => u.id !== parseInt(req.params.id));
  writeUsers(users);
  res.json({ message: "User deleted" });
});

// Routes: Leads
app.get("/api/leads/me", verifyToken, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 50;
  const leads = readLeads();

  const userLeads = leads.filter((l) => l.assigned_to === req.user.id);

  res.json({
    leads: userLeads.slice(offset, offset + limit),
    total: userLeads.length,
  });
});

app.get("/api/leads/search", verifyToken, (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const leads = readLeads();

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      l.phone.includes(query),
  );

  if (req.user.role !== "ADMIN") {
    return res.json({
      results: filtered.filter((l) => l.assigned_to === req.user.id),
    });
  }

  res.json({ results: filtered });
});

app.get("/api/leads", verifyToken, isAdmin, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 50;
  const leads = readLeads();

  res.json({
    leads: leads.slice(offset, offset + limit),
    total: leads.length,
  });
});

app.get("/api/leads/:id", verifyToken, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === parseInt(req.params.id));

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  if (req.user.role !== "ADMIN" && lead.assigned_to !== req.user.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  res.json(lead);
});

app.post("/api/leads", verifyToken, isAdmin, (req, res) => {
  const leads = readLeads();
  const { name, email, phone, status, source, amount, notes } = req.body;

  const newLead = {
    id: Math.max(...leads.map((l) => l.id), 0) + 1,
    name,
    email,
    phone,
    status: status || "NEW",
    source: source || "MANUAL",
    amount: amount || 0,
    notes,
    assigned_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  leads.push(newLead);
  writeLeads(leads);

  res.json(newLead);
});

app.put("/api/leads/:id", verifyToken, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === parseInt(req.params.id));

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  if (req.user.role !== "ADMIN" && lead.assigned_to !== req.user.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  Object.assign(lead, req.body, {
    updated_at: new Date().toISOString(),
  });

  writeLeads(leads);
  res.json(lead);
});

app.delete("/api/leads/:id", verifyToken, isAdmin, (req, res) => {
  let leads = readLeads();
  leads = leads.filter((l) => l.id !== parseInt(req.params.id));
  writeLeads(leads);
  res.json({ message: "Lead deleted" });
});

app.put("/api/leads/:id/assign", verifyToken, isAdmin, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === parseInt(req.params.id));

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  lead.assigned_to = req.body.user_id || null;
  lead.updated_at = new Date().toISOString();

  writeLeads(leads);
  res.json(lead);
});

// Routes: Import (stub for now)
app.post("/api/leads/import", verifyToken, isAdmin, (req, res) => {
  res.json({
    message: "Import functionality requires xlsx parser. Please implement.",
  });
});

// Start server
initializeDataFiles();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Data stored in: ${DATA_DIR}`);
  console.log("\n🔑 Test Credentials:");
  console.log("  Admin: admin@test.com / admin123");
  console.log("  Agent1: agent1@test.com / agent123");
  console.log("  Agent2: agent2@test.com / agent123");
});

module.exports = app;
