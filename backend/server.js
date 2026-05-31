const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const requiredProductionEnv = ["JWT_SECRET"];
if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter((key) => !process.env[key]);
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    missing.push("DATABASE_URL or DB_HOST");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required production env: ${missing.join(", ")}`);
  }
}

// Import routes
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const leadsRoutes = require("./routes/leads");
const clientsRoutes = require("./routes/clients");
const logsRoutes = require("./routes/logs");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, try again later" },
  }),
);
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: "File too large. Maximum size is 5MB.",
  }),
);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, "../frontend/public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/logs", logsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(
      `Frontend: ${process.env.FRONTEND_URL || `http://localhost:${PORT}`}`,
    );
  });
}

module.exports = app;
