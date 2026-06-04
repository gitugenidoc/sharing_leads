const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const XLSX = require("xlsx");
const rateLimit = require("express-rate-limit");
const {
  validateLead,
  validateUser,
  validateEmail,
  validatePhone,
  validateStatus,
  validStatuses,
} = require("./middleware/validation");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Data files
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Create uploads directory
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again later",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many requests, please try again later",
});

// Middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend/public")));

// Apply rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth/login", loginLimiter);

// Initialize data files
function initializeDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    const admin = {
      id: 1,
      email: "contact@jechangemamutuelle.online",
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
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Validation failed",
        details: [
          !email && "Email is required",
          !password && "Password is required",
          !name && "Name is required",
        ].filter(Boolean),
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["Invalid email format"],
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["Password must be at least 6 characters"],
      });
    }

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
  } catch (error) {
    res.status(500).json({
      error: "Registration failed",
      details: error.message,
    });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["Email and password are required"],
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid email or password" });
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
  } catch (error) {
    res.status(500).json({
      error: "Login failed",
      details: error.message,
    });
  }
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
  try {
    const validation = validateLead(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors,
      });
    }

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
  } catch (error) {
    res.status(500).json({
      error: "Failed to create lead",
      details: error.message,
    });
  }
});

app.put("/api/leads/:id", verifyToken, (req, res) => {
  try {
    const leads = readLeads();
    const lead = leads.find((l) => l.id === parseInt(req.params.id));

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    if (req.user.role !== "ADMIN" && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate if status is being updated
    if (req.body.status && !validateStatus(req.body.status)) {
      return res.status(400).json({
        error: "Validation failed",
        details: [`Status must be one of: ${validStatuses.join(", ")}`],
      });
    }

    Object.assign(lead, req.body, {
      updated_at: new Date().toISOString(),
    });

    writeLeads(leads);
    res.json(lead);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update lead",
      details: error.message,
    });
  }
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

// Routes: Import Excel
app.post(
  "/api/leads/import",
  verifyToken,
  isAdmin,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Read Excel file
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        fs.unlinkSync(req.file.path); // Delete file
        return res.status(400).json({ error: "Excel file is empty" });
      }

      const leads = readLeads();
      const importedLeads = [];
      const errors = [];
      let successCount = 0;

      // Process each row
      data.forEach((row, index) => {
        try {
          const leadData = {
            name: row.name || row.Name || row.nom || "",
            email: row.email || row.Email || row.email_address || "",
            phone: row.phone || row.Phone || row.telephone || "",
            status: row.status || row.Status || "NEW",
            source: "IMPORT",
            amount:
              parseFloat(row.amount || row.Amount || row.montant || 0) || 0,
            notes: row.notes || row.Notes || "",
          };

          // Validate
          const validation = validateLead(leadData);
          if (!validation.isValid) {
            errors.push({
              row: index + 2,
              message: validation.errors.join("; "),
            });
            return;
          }

          // Create lead
          const newLead = {
            id: Math.max(...leads.map((l) => l.id), 0) + 1,
            ...leadData,
            assigned_to: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          leads.push(newLead);
          importedLeads.push(newLead);
          successCount++;
        } catch (error) {
          errors.push({
            row: index + 2,
            message: error.message,
          });
        }
      });

      // Save updated leads
      if (importedLeads.length > 0) {
        writeLeads(leads);
      }

      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: `Import completed: ${successCount} leads imported`,
        imported: successCount,
        total: data.length,
        errors: errors,
        leads: importedLeads,
      });
    } catch (error) {
      // Clean up file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Failed to import leads",
        details: error.message,
      });
    }
  },
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "File too large",
        details: ["Maximum file size is 5MB"],
      });
    }
  }

  if (err.message === "Only Excel files are allowed") {
    return res.status(400).json({
      error: "Invalid file type",
      details: ["Only Excel files (.xlsx, .xls) are allowed"],
    });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    details: process.env.NODE_ENV === "development" ? [err.stack] : [],
  });
});

// Start server
initializeDataFiles();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Data stored in: ${DATA_DIR}`);
  console.log(`📁 Uploads stored in: ${UPLOAD_DIR}`);
  console.log("\n🔑 Test Credentials:");
  console.log("  Admin: contact@jechangemamutuelle.online / admin123");
  console.log("  Agent1: agent1@test.com / agent123");
  console.log("  Agent2: agent2@test.com / agent123");
  console.log("\n🔒 Security:");
  console.log(
    "  - Rate limiting: 5 login attempts per 15 min, 100 API calls per min",
  );
  console.log("  - File upload: 5MB max, Excel only");
  console.log("  - Validation: Client-side + server-side");
});

module.exports = app;
