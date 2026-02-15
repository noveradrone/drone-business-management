const express = require("express");
const db = require("../db");
const { authRequired, rolesAllowed } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, rolesAllowed("admin"), (req, res) => {
  const users = db.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY id DESC").all();
  res.json(users);
});

module.exports = router;
