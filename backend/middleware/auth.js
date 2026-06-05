const jwt = require("jsonwebtoken");
require("dotenv").config();

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const isAdminRole = (role) => ["SUPER_ADMIN", "ADMIN"].includes(role);
const isCenterViewerRole = (role) =>
  ["SUPER_ADMIN", "ADMIN", "SUPERVISOR"].includes(role);
const isValidationViewerRole = (role) =>
  ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "VALIDATION"].includes(role);

// Check if user can access admin features
const isAdmin = (req, res, next) => {
  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const isCenterViewer = (req, res, next) => {
  if (!isCenterViewerRole(req.user.role)) {
    return res.status(403).json({ error: "Center visibility access required" });
  }
  next();
};

const isValidationViewer = (req, res, next) => {
  if (!isValidationViewerRole(req.user.role)) {
    return res.status(403).json({ error: "Validation access required" });
  }
  next();
};

const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
};

// Check if user is owner or admin
const isOwnerOrAdmin = (req, res, next) => {
  const leadUserId = req.leadUserId; // Should be set by the route handler
  if (!isAdminRole(req.user.role) && req.user.id !== leadUserId) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isAdminRole,
  isCenterViewer,
  isCenterViewerRole,
  isValidationViewer,
  isValidationViewerRole,
  isSuperAdmin,
  isOwnerOrAdmin,
};
