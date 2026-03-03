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
    notes,
    last_maintenance_date,
    incident_history,
    battery_cycle_threshold = 300,
    propeller_hours_threshold = 120
  } = req.body;
  if (!brand || !model || !serial_number) {
    return res.status(400).json({ message: "brand, model and serial_number are required" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO drones (
          brand, model, serial_number, status, purchase_date, purchase_price, notes,
          last_maintenance_date, incident_history, battery_cycle_threshold, propeller_hours_threshold
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        brand,
        model,
        serial_number,
        status,
        purchase_date || null,
        purchase_price || null,
        notes || null,
        last_maintenance_date || null,
        incident_history || null,
        Number(battery_cycle_threshold || 300),
        Number(propeller_hours_threshold || 120)
      );

    const created = db.prepare("SELECT * FROM drones WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.put("/:id", authRequired, (req, res) => {
  const existing = db.prepare("SELECT * FROM drones WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Drone not found" });

  const {
    brand,
    model,
    serial_number,
    status,
    purchase_date,
    purchase_price,
    notes,
    last_maintenance_date,
    incident_history,
    battery_cycle_threshold,
    propeller_hours_threshold
  } = req.body;

  const next = {
    brand: brand !== undefined ? String(brand).trim() : existing.brand,
    model: model !== undefined ? String(model).trim() : existing.model,
    serial_number: serial_number !== undefined ? String(serial_number).trim() : existing.serial_number,
    status: status !== undefined ? String(status).trim() : existing.status,
    purchase_date:
      purchase_date !== undefined ? (String(purchase_date).trim() ? String(purchase_date).trim() : null) : existing.purchase_date,
    purchase_price:
      purchase_price !== undefined && String(purchase_price).trim() !== ""
        ? Number(purchase_price)
        : purchase_price !== undefined
        ? null
        : existing.purchase_price,
    notes: notes !== undefined ? (String(notes).trim() ? String(notes) : null) : existing.notes,
    last_maintenance_date:
      last_maintenance_date !== undefined
        ? (String(last_maintenance_date).trim() ? String(last_maintenance_date).trim() : null)
        : existing.last_maintenance_date,
    incident_history:
      incident_history !== undefined ? (String(incident_history).trim() ? String(incident_history) : null) : existing.incident_history,
    battery_cycle_threshold:
      battery_cycle_threshold !== undefined
        ? Number(battery_cycle_threshold)
        : Number(existing.battery_cycle_threshold || 300),
    propeller_hours_threshold:
      propeller_hours_threshold !== undefined
        ? Number(propeller_hours_threshold)
        : Number(existing.propeller_hours_threshold || 120)
  };

  if (!next.brand || !next.model || !next.serial_number) {
    return res.status(400).json({ message: "brand, model and serial_number are required" });
  }
  if (!["active", "maintenance", "grounded", "retired"].includes(next.status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  if (Number.isNaN(next.purchase_price) || Number.isNaN(next.battery_cycle_threshold) || Number.isNaN(next.propeller_hours_threshold)) {
    return res.status(400).json({ message: "Invalid numeric fields" });
  }

  try {
    db.prepare(
      `UPDATE drones
       SET brand = ?,
           model = ?,
           serial_number = ?,
           status = ?,
           purchase_date = ?,
           purchase_price = ?,
           notes = ?,
           last_maintenance_date = ?,
           incident_history = ?,
           battery_cycle_threshold = ?,
           propeller_hours_threshold = ?
       WHERE id = ?`
    ).run(
      next.brand,
      next.model,
      next.serial_number,
      next.status,
      next.purchase_date,
      next.purchase_price,
      next.notes,
      next.last_maintenance_date,
      next.incident_history,
      next.battery_cycle_threshold,
      next.propeller_hours_threshold,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM drones WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", authRequired, (req, res) => {
  const result = db.prepare("DELETE FROM drones WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Drone not found" });
  res.status(204).send();
});

module.exports = router;
