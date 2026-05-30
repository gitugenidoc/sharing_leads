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

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Check if user is owner or admin
const isOwnerOrAdmin = (req, res, next) => {
  const leadUserId = req.leadUserId; // Should be set by the route handler
  if (req.user.role !== "ADMIN" && req.user.id !== leadUserId) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isOwnerOrAdmin,
};
