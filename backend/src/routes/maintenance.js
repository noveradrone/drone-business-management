const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, d.brand, d.model, d.serial_number
       FROM maintenance_records m
       JOIN drones d ON d.id = m.drone_id
       ORDER BY m.maintenance_date DESC`
    )
    .all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const {
    drone_id,
    maintenance_date,
    maintenance_type,
    description,
    parts_replaced,
    flight_hours_at_maintenance,
    cycles_at_maintenance,
    cost,
    next_due_date
  } = req.body;

  if (!drone_id || !maintenance_date || !maintenance_type) {
    return res.status(400).json({ message: "drone_id, maintenance_date and maintenance_type are required" });
  }

  const tx = db.transaction(() => {
    const insert = db
      .prepare(
        `INSERT INTO maintenance_records (
          drone_id, maintenance_date, maintenance_type, description, parts_replaced,
          flight_hours_at_maintenance, cycles_at_maintenance, cost, next_due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        drone_id,
        maintenance_date,
        maintenance_type,
        description || null,
        parts_replaced || null,
        flight_hours_at_maintenance || null,
        cycles_at_maintenance || null,
        cost || null,
        next_due_date || null
      );

    db.prepare(
      `UPDATE drones
       SET total_flight_hours = CASE
           WHEN ? IS NULL THEN total_flight_hours
           ELSE MAX(total_flight_hours, ?)
         END,
         total_cycles = CASE
           WHEN ? IS NULL THEN total_cycles
           ELSE MAX(total_cycles, ?)
         END,
         last_maintenance_date = ?
       WHERE id = ?`
    ).run(
      flight_hours_at_maintenance || null,
      flight_hours_at_maintenance || null,
      cycles_at_maintenance || null,
      cycles_at_maintenance || null,
      maintenance_date,
      drone_id
    );

    return insert.lastInsertRowid;
  });

  const id = tx();
  refreshAutomaticReminders();
  res.status(201).json(db.prepare("SELECT * FROM maintenance_records WHERE id = ?").get(id));
});

module.exports = router;
