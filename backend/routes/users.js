const express = require("express");
const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all users (admin only)
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    // Can only view own user or if admin
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await User.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user (admin only)
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, role } = req.body;

    const user = await User.updateUser(req.params.id, name, role);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete user (admin only)
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await User.deleteUser(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
