const express = require("express");
const User = require("../models/User");
const Log = require("../models/Log");
const {
  verifyToken,
  isAdmin,
  isAdminRole,
  isCenterViewer,
} = require("../middleware/auth");
const { validateUser } = require("../middleware/validation-mutuelle");

const router = express.Router();

const canManageUser = (actor, target) => {
  if (actor.role === "SUPER_ADMIN") {
    return target.role !== "SUPER_ADMIN" || actor.id === target.id;
  }
  if (actor.role === "ADMIN") {
    return (
      ["AGENT", "SUPERVISOR"].includes(target.role) &&
      actor.center_id &&
      actor.center_id === target.center_id
    );
  }
  return actor.id === target.id;
};

router.get("/centers", verifyToken, isAdmin, async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.json([]);
    }
    const centers = await User.getCenters();
    res.json(centers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", verifyToken, isCenterViewer, async (req, res) => {
  try {
    const users = await User.getAllUsers(req.user);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const user = await User.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!canManageUser(req.user, user) && req.user.id !== user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const existingUser = await User.getUserById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canManageUser(req.user, existingUser)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let requestedRole = req.body.role || existingUser.role;
    if (req.user.role === "ADMIN" && !["AGENT", "SUPERVISOR"].includes(requestedRole)) {
      requestedRole = existingUser.role === "SUPERVISOR" ? "SUPERVISOR" : "AGENT";
    }
    if (requestedRole === "SUPER_ADMIN" && req.user.id !== existingUser.id) {
      return res.status(403).json({ error: "Cannot promote users to super admin" });
    }

    const requestedEmail = String(req.body.email || existingUser.email)
      .trim()
      .toLowerCase();
    const validation = validateUser({
      email: requestedEmail,
      name: req.body.name,
      role: requestedRole,
    });
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: validation.errors });
    }

    if (requestedEmail !== existingUser.email) {
      const duplicateUser = await User.getUserByEmail(requestedEmail);
      if (duplicateUser && duplicateUser.id !== existingUser.id) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    let centerId = existingUser.center_id;
    if (req.user.role === "ADMIN") {
      centerId = req.user.center_id;
    } else if (req.body.center_name || req.body.centerName) {
      const center = await User.getOrCreateCenter(
        req.body.center_name || req.body.centerName,
      );
      centerId = center.id;
    } else if (req.body.center_id || req.body.centerId) {
      centerId = parseInt(req.body.center_id || req.body.centerId, 10);
    }

    if (requestedRole !== "SUPER_ADMIN" && !centerId) {
      return res.status(400).json({ error: "Center is required" });
    }

    const user = await User.updateUser(req.params.id, {
      email: requestedEmail,
      name: req.body.name,
      role: requestedRole,
      centerId: requestedRole === "SUPER_ADMIN" ? null : centerId,
    });
    await Log.createAuditLog({
      userId: req.user.id,
      action: "UPDATE",
      entityType: "user",
      entityId: user.id,
      oldValue: existingUser,
      newValue: user,
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message || "Server error" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id, 10)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const user = await User.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!isAdminRole(req.user.role) || !canManageUser(req.user, user)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await User.deleteUser(req.params.id);
    await Log.createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "user",
      entityId: user.id,
      oldValue: user,
    });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
