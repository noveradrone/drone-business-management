const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM articles ORDER BY name ASC").all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const { name, description, price, tax_rate } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });
  try {
    const result = db
      .prepare(
        `INSERT INTO articles (name, description, price, tax_rate)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, description || null, Number(price || 0), Number(tax_rate || 20));
    const row = db.prepare("SELECT * FROM articles WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
