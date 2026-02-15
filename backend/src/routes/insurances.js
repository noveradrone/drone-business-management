const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM insurances ORDER BY valid_until ASC").all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const {
    provider,
    policy_number,
    coverage_details,
    insured_entity_type,
    insured_entity_id,
    valid_from,
    valid_until,
    premium_amount,
    notes
  } = req.body;

  if (!provider || !policy_number || !insured_entity_type || !valid_from || !valid_until) {
    return res.status(400).json({
      message:
        "provider, policy_number, insured_entity_type, valid_from and valid_until are required"
    });
  }

  const result = db
    .prepare(
      `INSERT INTO insurances (
        provider, policy_number, coverage_details, insured_entity_type,
        insured_entity_id, valid_from, valid_until, premium_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      provider,
      policy_number,
      coverage_details || null,
      insured_entity_type,
      insured_entity_id || null,
      valid_from,
      valid_until,
      premium_amount || null,
      notes || null
    );

  refreshAutomaticReminders();
  res.status(201).json(db.prepare("SELECT * FROM insurances WHERE id = ?").get(result.lastInsertRowid));
});

module.exports = router;
