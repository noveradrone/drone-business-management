const express = require("express");
const { stringify } = require("csv-stringify/sync");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/csv/:entity", authRequired, (req, res) => {
  const allowed = {
    drones: "SELECT * FROM drones ORDER BY id DESC",
    clients: "SELECT * FROM clients ORDER BY id DESC",
    missions: "SELECT * FROM missions ORDER BY id DESC",
    invoices: "SELECT * FROM invoices ORDER BY id DESC",
    insurances: "SELECT * FROM insurances ORDER BY id DESC",
    maintenance: "SELECT * FROM maintenance_records ORDER BY id DESC",
    payments: "SELECT * FROM payments ORDER BY id DESC"
  };

  const sql = allowed[req.params.entity];
  if (!sql) {
    return res.status(400).json({ message: "Invalid entity. Use drones, clients, missions, invoices, insurances, maintenance, payments" });
  }

  const rows = db.prepare(sql).all();
  const csv = stringify(rows, { header: true });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${req.params.entity}.csv`);
  res.send(csv);
});

module.exports = router;
