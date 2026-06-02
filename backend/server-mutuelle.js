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
const nodemailer = require("nodemailer");
const {
  validateClient,
  validateUser,
  validatePostalCode,
  validateStatus,
  validStatuses,
} = require("./middleware/validation-mutuelle");

const app = express();
const PORT = process.env.PORT || 5000;

const getTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else {
    // Ethereal automatic test account for testing
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};
const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Data files
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");
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
      name: "Super Admin",
      password: bcrypt.hashSync("admin123", 10),
      role: "SUPER_ADMIN",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([admin], null, 2));
  }

  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify([], null, 2));
  }
}

// Helper functions
function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readClients() {
  return JSON.parse(fs.readFileSync(CLIENTS_FILE, "utf8"));
}

function writeClients(clients) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

function readEmails() {
  if (!fs.existsSync(EMAILS_FILE)) {
    fs.writeFileSync(EMAILS_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(EMAILS_FILE, "utf8"));
}

function writeEmails(emails) {
  fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
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
  if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
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

app.get("/api/auth/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Routes: Users
app.get("/api/users", verifyToken, isAdmin, (req, res) => {
  try {
    const users = readUsers();
    const clients = readClients();

    const result = users.map((u) => ({
      ...u,
      password: undefined,
      clients_count: clients.filter((c) => c.assigned_to === u.id).length,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load users",
      details: error.message,
    });
  }
});

app.post("/api/users", verifyToken, isAdmin, (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({
      error: "Failed to create user",
      details: error.message,
    });
  }
});

app.delete("/api/users/:id", verifyToken, isAdmin, (req, res) => {
  try {
    let users = readUsers();
    users = users.filter((u) => u.id !== parseInt(req.params.id));
    writeUsers(users);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete user",
      details: error.message,
    });
  }
});

// Helper for timed assignments auto-release
function releaseExpiredAssignments() {
  try {
    const clients = readClients();
    const now = new Date();
    let modified = false;

    clients.forEach((c) => {
      if (
        c.assigned_to &&
        c.assignment_expires_at &&
        new Date(c.assignment_expires_at) < now
      ) {
        c.assigned_to = null;
        c.assigned_at = null;
        c.assignment_expires_at = null;
        c.updated_at = now.toISOString();
        modified = true;
      }
    });

    if (modified) {
      writeClients(clients);
      console.log("[Auto-Release JSON] Released expired client assignments.");
    }
  } catch (err) {
    console.error("Error in releaseExpiredAssignments:", err);
  }
}

// Mail service templates
const MAIL_TEMPLATES = [
  {
    id: "relance",
    name: "Relance Client",
    subject: "Des nouvelles de votre demande de mutuelle - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nNous avons tenté de vous joindre aujourd'hui au sujet de votre demande de comparatif de mutuelle.\n\nPourriez-vous nous indiquer vos disponibilités afin que nous puissions faire le point ensemble sur vos besoins ?\n\nCordialement,\nL'équipe SecurAssure",
  },
  {
    id: "offre_senior",
    name: "Offre Mutuelle Senior",
    subject: "Des garanties renforcées pour votre mutuelle - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nDécouvrez nos nouvelles garanties spécifiquement conçues pour les seniors : prise en charge renforcée des frais d'optique, de dentaire et des médecines douces.\n\nNous sommes à votre disposition pour vous réaliser un devis gratuit et personnalisé.\n\nCordialement,\nL'équipe SecurAssure",
  },
  {
    id: "confirm_rdv",
    name: "Confirmation de Rendez-vous",
    subject: "Confirmation de votre rendez-vous - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nNous vous confirmons votre rendez-vous avec un de nos conseillers SecurAssure.\n\nNous vous recontacterons au numéro fourni.\n\nCordialement,\nL'équipe SecurAssure",
  },
];

// Mail Routes
app.get("/api/mail/templates", verifyToken, (req, res) => {
  res.json(MAIL_TEMPLATES);
});

app.post("/api/mail/send", verifyToken, async (req, res) => {
  const { recipientEmail, recipientName, subject, body } = req.body;
  const senderId = req.user.id;

  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from:
        process.env.SMTP_FROM ||
        `"SecurAssure" <contact@jechangemamutuelle.online>`,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl = "";
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }

    const emails = readEmails();
    const newEmail = {
      id: Math.max(...emails.map((e) => e.id), 0) + 1,
      sender_id: senderId,
      sender_name: req.user.name,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject,
      body,
      status: "SENT",
      created_at: new Date().toISOString(),
    };

    emails.push(newEmail);
    writeEmails(emails);

    res.json({
      message: previewUrl
        ? "E-mail envoyé avec succès (simulation SMTP)"
        : "E-mail envoyé avec succès",
      mailId: newEmail.id,
      status: "SENT",
      created_at: newEmail.created_at,
      previewUrl,
    });
  } catch (err) {
    console.error("Error sending mail in mutuelle server:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de l'envoi de l'e-mail : " + err.message });
  }
});

app.get("/api/mail/history", verifyToken, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const emails = readEmails();

  let filtered = emails;
  if (userRole === "AGENT") {
    filtered = emails.filter((e) => e.sender_id === userId);
  }

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(filtered);
});

// Routes: Clients
app.get("/api/clients/me", verifyToken, (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const clients = readClients();

    const userClients = clients.filter((c) => c.assigned_to === req.user.id);

    res.json({
      clients: userClients.slice(offset, offset + limit),
      total: userClients.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load clients",
      details: error.message,
    });
  }
});

app.get("/api/clients/search", verifyToken, (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || "";
    const clients = readClients();

    const filtered = clients.filter(
      (c) =>
        c.nom.toLowerCase().includes(query) ||
        c.prenom.toLowerCase().includes(query) ||
        c.ville.toLowerCase().includes(query) ||
        c.nom_mutuelle.toLowerCase().includes(query),
    );

    if (req.user.role !== "ADMIN") {
      return res.json({
        results: filtered.filter((c) => c.assigned_to === req.user.id),
      });
    }

    res.json({ results: filtered });
  } catch (error) {
    res.status(500).json({
      error: "Search failed",
      details: error.message,
    });
  }
});

app.get("/api/clients", verifyToken, isAdmin, (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const clients = readClients();

    res.json({
      clients: clients.slice(offset, offset + limit),
      total: clients.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load clients",
      details: error.message,
    });
  }
});

app.get("/api/clients/:id", verifyToken, (req, res) => {
  try {
    const clients = readClients();
    const client = clients.find((c) => c.id === parseInt(req.params.id));

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (req.user.role !== "ADMIN" && client.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load client",
      details: error.message,
    });
  }
});

app.post("/api/clients", verifyToken, isAdmin, (req, res) => {
  try {
    const validation = validateClient(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors,
      });
    }

    const clients = readClients();
    const {
      nom,
      prenom,
      adresse,
      ville,
      code_postal,
      nom_mutuelle,
      prix_mutuelle,
      status,
      notes,
    } = req.body;

    const newClient = {
      id: Math.max(...clients.map((c) => c.id), 0) + 1,
      nom,
      prenom,
      adresse,
      ville,
      code_postal,
      nom_mutuelle,
      prix_mutuelle,
      status: status || "NEW",
      notes,
      assigned_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    clients.push(newClient);
    writeClients(clients);

    res.json(newClient);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create client",
      details: error.message,
    });
  }
});

app.put("/api/clients/:id", verifyToken, (req, res) => {
  try {
    const clients = readClients();
    const client = clients.find((c) => c.id === parseInt(req.params.id));

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (req.user.role !== "ADMIN" && client.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate if status is being updated
    if (req.body.status && !validateStatus(req.body.status)) {
      return res.status(400).json({
        error: "Validation failed",
        details: [`Status must be one of: ${validStatuses.join(", ")}`],
      });
    }

    Object.assign(client, req.body, {
      updated_at: new Date().toISOString(),
    });

    writeClients(clients);
    res.json(client);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update client",
      details: error.message,
    });
  }
});

app.delete("/api/clients/:id", verifyToken, isAdmin, (req, res) => {
  try {
    let clients = readClients();
    clients = clients.filter((c) => c.id !== parseInt(req.params.id));
    writeClients(clients);
    res.json({ message: "Client deleted" });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete client",
      details: error.message,
    });
  }
});

app.put("/api/clients/:id/assign", verifyToken, isAdmin, (req, res) => {
  try {
    const clients = readClients();
    const client = clients.find((c) => c.id === parseInt(req.params.id));

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    client.assigned_to =
      parseInt(req.body.userId || req.body.user_id, 10) || null;
    client.updated_at = new Date().toISOString();

    writeClients(clients);
    res.json(client);
  } catch (error) {
    res.status(500).json({
      error: "Failed to assign client",
      details: error.message,
    });
  }
});

app.post("/api/clients/assign-random", verifyToken, isAdmin, (req, res) => {
  try {
    const userId = parseInt(req.body.userId, 10);
    const count = parseInt(req.body.count, 10);

    if (!userId || !count || count < 1) {
      return res.status(400).json({
        error: "User ID and a positive count are required",
      });
    }

    const clients = readClients();
    const selectedClients = clients
      .filter((client) => !client.assigned_to)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    selectedClients.forEach((client) => {
      client.assigned_to = userId;
      client.updated_at = new Date().toISOString();
    });

    writeClients(clients);
    res.json({
      assigned: selectedClients.length,
      requested: count,
      clients: selectedClients,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to assign random clients",
      details: error.message,
    });
  }
});

// Routes: Import Excel
app.post(
  "/api/clients/import",
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
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Excel file is empty" });
      }

      const clients = readClients();
      const importedClients = [];
      const errors = [];
      let successCount = 0;

      // Process each row
      data.forEach((row, index) => {
        try {
          const clientData = {
            nom: row.Nom || row.nom || "",
            prenom: row.Prenom || row.prenom || "",
            adresse: row.Adresse || row.adresse || "",
            ville: row.Ville || row.ville || "",
            code_postal: String(row["Code postal"] || row["code_postal"] || ""),
            nom_mutuelle: row["Nom mutuelle"] || row["nom_mutuelle"] || "",
            prix_mutuelle:
              parseFloat(row["Prix mutuelle"] || row["prix_mutuelle"] || 0) ||
              0,
            status: row.Status || row.status || "NEW",
          };

          // Validate
          const validation = validateClient(clientData);
          if (!validation.isValid) {
            errors.push({
              row: index + 2,
              message: validation.errors.join("; "),
            });
            return;
          }

          // Create client
          const newClient = {
            id: Math.max(...clients.map((c) => c.id), 0) + 1,
            ...clientData,
            assigned_to: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          clients.push(newClient);
          importedClients.push(newClient);
          successCount++;
        } catch (error) {
          errors.push({
            row: index + 2,
            message: error.message,
          });
        }
      });

      // Save updated clients
      if (importedClients.length > 0) {
        writeClients(clients);
      }

      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: `Import completed: ${successCount} clients imported`,
        imported: successCount,
        total: data.length,
        errors: errors,
        clients: importedClients,
      });
    } catch (error) {
      // Clean up file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Failed to import clients",
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Data stored in: ${DATA_DIR}`);
  console.log(`📁 Uploads stored in: ${UPLOAD_DIR}`);
  console.log(`\n💼 Mutual Insurance Client Management System`);
  console.log("\n🔑 Test Credentials:");
  console.log("  Admin: admin@test.com / admin123");
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
