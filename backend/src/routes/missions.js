const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { computeMissionFinancials } = require("../services/missionMetrics");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         m.*,
         c.company_name,
         c.source_channel,
         d.serial_number,
         d.brand,
         d.model,
         (
           SELECT COALESCE(SUM(i.total), 0)
           FROM invoices i
           WHERE i.mission_id = m.id
         ) AS mission_revenue
       FROM missions m
       JOIN clients c ON c.id = m.client_id
       JOIN drones d ON d.id = m.drone_id
       ORDER BY m.mission_date DESC`
    )
    .all();
  const withFinancials = rows.map((row) => ({
    ...row,
    ...computeMissionFinancials(row, row.mission_revenue)
  }));
  res.json(withFinancials);
});

router.post("/", authRequired, (req, res) => {
  const {
    drone_id,
    client_id,
    mission_date,
    location,
    duration_minutes,
    flight_hours_logged = 0,
    cycles_logged = 0,
    preparation_hours = 0,
    flight_time_hours = 0,
    montage_hours = 0,
    mileage_km = 0,
    variable_costs = 0,
    department = null,
    selected_pack = null,
    mission_status = "planned",
    photo_url,
    notes
  } = req.body;

  if (!drone_id || !client_id || !mission_date || !location || !duration_minutes) {
    return res.status(400).json({
      message: "drone_id, client_id, mission_date, location and duration_minutes are required"
    });
  }

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO missions (
          drone_id, client_id, mission_date, location, duration_minutes,
          flight_hours_logged, cycles_logged,
          preparation_hours, flight_time_hours, montage_hours, mileage_km, variable_costs,
          department, selected_pack, mission_status, photo_url, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        drone_id,
        client_id,
        mission_date,
        location,
        duration_minutes,
        flight_hours_logged,
        cycles_logged,
        preparation_hours,
        flight_time_hours,
        montage_hours,
        mileage_km,
        variable_costs,
        department || null,
        selected_pack || null,
        mission_status || "planned",
        photo_url || null,
        notes || null
      );

    db.prepare(
      `UPDATE drones
       SET total_flight_hours = total_flight_hours + ?,
           total_cycles = total_cycles + ?
       WHERE id = ?`
    ).run(flight_hours_logged, cycles_logged, drone_id);

    return result.lastInsertRowid;
  });

  const missionId = tx();
  const mission = db.prepare("SELECT * FROM missions WHERE id = ?").get(missionId);
  res.status(201).json({
    ...mission,
    ...computeMissionFinancials(mission, 0)
  });
});

router.delete("/:id", authRequired, (req, res) => {
  const tx = db.transaction(() => {
    const mission = db.prepare("SELECT * FROM missions WHERE id = ?").get(req.params.id);
    if (!mission) throw new Error("Mission not found");

    db.prepare(
      `UPDATE drones
       SET total_flight_hours = MAX(0, total_flight_hours - ?),
           total_cycles = MAX(0, total_cycles - ?)
       WHERE id = ?`
    ).run(Number(mission.flight_hours_logged || 0), Number(mission.cycles_logged || 0), mission.drone_id);

    db.prepare("DELETE FROM missions WHERE id = ?").run(req.params.id);
  });

  try {
    tx();
    return res.status(204).send();
  } catch (error) {
    if (error.message === "Mission not found") return res.status(404).json({ message: error.message });
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
