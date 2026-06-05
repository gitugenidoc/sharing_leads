const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Log = require("../models/Log");
const { verifyToken, isAdminRole } = require("../middleware/auth");
const { validateUser } = require("../middleware/validation-mutuelle");
require("dotenv").config();

const router = express.Router();

const getCreatorFromToken = async (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.getUserById(decoded.id);
};

const resolveCenterForNewUser = async ({ creator, requestedRole, body }) => {
  if (!creator) {
    return null;
  }

  if (creator.role === "ADMIN") {
    if (!["AGENT", "SUPERVISOR", "VALIDATION"].includes(requestedRole)) {
      const error = new Error("Center admins can only create agents, supervisors or validation users");
      error.statusCode = 403;
      throw error;
    }
    return creator.center_id;
  }

  if (creator.role === "SUPER_ADMIN") {
    const centerName = body.center_name || body.centerName;
    if (centerName) {
      const center = await User.getOrCreateCenter(centerName);
      return center.id;
    }

    if (body.center_id || body.centerId) {
      return parseInt(body.center_id || body.centerId, 10);
    }

    if (requestedRole !== "SUPER_ADMIN") {
      const error = new Error("Center is required for center admins and agents");
      error.statusCode = 400;
      throw error;
    }
  }

  return null;
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    let requestedRole = role || "AGENT";
    let creator = null;

    if (req.headers.authorization) {
      try {
        creator = await getCreatorFromToken(req);
      } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    if (creator) {
      if (!isAdminRole(creator.role)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      if (requestedRole === "SUPER_ADMIN") {
        return res.status(403).json({ error: "Super admin cannot be created here" });
      }
      if (creator.role === "ADMIN" && !["AGENT", "SUPERVISOR", "VALIDATION"].includes(requestedRole)) {
        requestedRole = "AGENT";
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

    const existingUser = await User.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const centerId = await resolveCenterForNewUser({
      creator,
      requestedRole,
      body: req.body,
    });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.createUser({
      email,
      password: hashedPassword,
      name,
      role: requestedRole,
      centerId,
      phoneNumber: req.body.phone_number || req.body.phoneNumber || "",
      smsSenderNumber: req.body.sms_sender_number || req.body.smsSenderNumber || "",
      whatsappBusinessNumber:
        req.body.whatsapp_business_number || req.body.whatsappBusinessNumber || "",
    });

    if (creator) {
      await Log.createAuditLog({
        userId: creator.id,
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
      center_id: newUser.center_id,
      center_name: newUser.center_name,
      phone_number: newUser.phone_number,
      sms_sender_number: newUser.sms_sender_number,
      whatsapp_business_number: newUser.whatsapp_business_number,
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message || "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        center_id: user.center_id,
        center_name: user.center_name,
        phone_number: user.phone_number,
        sms_sender_number: user.sms_sender_number,
        whatsapp_business_number: user.whatsapp_business_number,
      },
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
        center_id: user.center_id,
        center_name: user.center_name,
        phone_number: user.phone_number,
        sms_sender_number: user.sms_sender_number,
        whatsapp_business_number: user.whatsapp_business_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
