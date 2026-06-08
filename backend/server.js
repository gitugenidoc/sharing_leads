const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
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
const mailRoutes = require("./routes/mail");
const analyticsRoutes = require("./routes/analytics");
const whatsappRoutes = require("./routes/whatsapp");
const snaptelRoutes = require("./routes/snaptel");
const cronRoutes = require("./routes/cron");
const { router: chatbotRoutes } = require("./routes/chatbot");
const { releaseExpiredAssignments } = require("./models/Client");
const pool = require("./config/db");

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(bodyParser.json({ limit: "128kb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "128kb" }));
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
    message: { error: "Too many login attempts. Try again later." },
  }),
);
app.use(
  "/api/chatbot",
  rateLimit({
    windowMs: 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many chatbot requests. Try again later." },
  }),
);
app.use(
  fileUpload({
    limits: { fileSize: 25 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: "File too large. Maximum size is 25MB.",
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
app.use("/api/mail", mailRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/snaptel", snaptelRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/chatbot", chatbotRoutes);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok", timestamp: new Date() });
  } catch (err) {
    console.error("[Health] Database check failed:", err);
    res.status(503).json({ status: "error", database: "down", timestamp: new Date() });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(
      `Frontend: ${process.env.FRONTEND_URL || `http://localhost:${PORT}`}`,
    );
    if (!process.env.VERCEL) {
      releaseExpiredAssignments().catch((err) =>
        console.error("[Auto-Release] Initial release failed:", err),
      );
      setInterval(() => {
        releaseExpiredAssignments().catch((err) =>
          console.error("[Auto-Release] Scheduled release failed:", err),
        );
      }, 5 * 60 * 1000);
    }
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Closing server and database pool.`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
