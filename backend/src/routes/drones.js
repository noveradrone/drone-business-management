const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM drones ORDER BY id DESC").all();
  res.json(rows);
});

router.get("/:id", authRequired, (req, res) => {
  const row = db.prepare("SELECT * FROM drones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ message: "Drone not found" });
  res.json(row);
});

router.post("/", authRequired, (req, res) => {
  const {
    brand,
    model,
    serial_number,
    status = "active",
    purchase_date,
    purchase_price,
    notes
  } = req.body;
  if (!brand || !model || !serial_number) {
    return res.status(400).json({ message: "brand, model and serial_number are required" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO drones (brand, model, serial_number, status, purchase_date, purchase_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(brand, model, serial_number, status, purchase_date || null, purchase_price || null, notes || null);

    const created = db.prepare("SELECT * FROM drones WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.put("/:id", authRequired, (req, res) => {
  const { brand, model, serial_number, status, purchase_date, purchase_price, notes } = req.body;

  const result = db
    .prepare(
      `UPDATE drones
       SET brand = COALESCE(?, brand),
           model = COALESCE(?, model),
           serial_number = COALESCE(?, serial_number),
           status = COALESCE(?, status),
           purchase_date = COALESCE(?, purchase_date),
           purchase_price = COALESCE(?, purchase_price),
           notes = COALESCE(?, notes)
       WHERE id = ?`
    )
    .run(brand, model, serial_number, status, purchase_date, purchase_price, notes, req.params.id);

  if (!result.changes) return res.status(404).json({ message: "Drone not found" });
  const updated = db.prepare("SELECT * FROM drones WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/:id", authRequired, (req, res) => {
  const result = db.prepare("DELETE FROM drones WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Drone not found" });
  res.status(204).send();
});

module.exports = router;
