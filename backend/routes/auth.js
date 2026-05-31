const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Log = require("../models/Log");
const { verifyToken } = require("../middleware/auth");
const { validateUser } = require("../middleware/validation-mutuelle");
require("dotenv").config();

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    let requestedRole = role || "AGENT";
    let creatorUserId = null;

    if (requestedRole === "ADMIN") {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(403).json({ error: "Admin access required" });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== "ADMIN") {
          return res.status(403).json({ error: "Admin access required" });
        }
        creatorUserId = decoded.id;
      } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
      }
    } else {
      requestedRole = "AGENT";
    }

    const validation = validateUser({ email, password, name, role: requestedRole });
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: validation.errors });
    }

    // Check if user exists
    const existingUser = await User.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.createUser(
      email,
      hashedPassword,
      name,
      requestedRole,
    );

    if (creatorUserId) {
      await Log.createAuditLog({
        userId: creatorUserId,
        action: "CREATE",
        entityType: "user",
        entityId: newUser.id,
        newValue: newUser,
      });
    }

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    const user = await User.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
