const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");
const { authRequired } = require("../middleware/auth");
const { authLoginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", (req, res) => {
  const { name, email, password, role = "manager" } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }
  if (String(password).length < 10) {
    return res.status(400).json({ message: "Password must be at least 10 characters long" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(name, email, hash, role);

  return res.status(201).json({ id: result.lastInsertRowid, name, email, role });
});

router.post("/login", authLoginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, {
    expiresIn: "8h"
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

router.get("/me", authRequired, (req, res) => {
  const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(user);
});

module.exports = router;
