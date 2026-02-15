const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");

const router = express.Router();

router.get("/summary", authRequired, (req, res) => {
  refreshAutomaticReminders();

  const drones = db.prepare("SELECT COUNT(*) as count FROM drones").get().count;
  const missions = db.prepare("SELECT COUNT(*) as count FROM missions").get().count;
  const clients = db.prepare("SELECT COUNT(*) as count FROM clients").get().count;
  const invoicesOpen = db
    .prepare("SELECT COUNT(*) as count FROM invoices WHERE status IN ('sent','partial','overdue')")
    .get().count;

  const receivable = db
    .prepare("SELECT COALESCE(SUM(total - amount_received), 0) as value FROM invoices WHERE status != 'paid'")
    .get().value;

  const overdue = db.prepare("SELECT COUNT(*) as count FROM reminders WHERE reminder_type = 'invoice_overdue'").get().count;
  const insuranceExpiring = db
    .prepare("SELECT COUNT(*) as count FROM reminders WHERE reminder_type = 'insurance_expiry'")
    .get().count;
  const maintenanceDue = db
    .prepare("SELECT COUNT(*) as count FROM reminders WHERE reminder_type = 'maintenance_due'")
    .get().count;

  const topDrones = db
    .prepare(
      `SELECT id, brand, model, serial_number, total_flight_hours, total_cycles
       FROM drones
       ORDER BY total_flight_hours DESC
       LIMIT 5`
    )
    .all();

  const cashflow = db
    .prepare(
      `SELECT substr(payment_date, 1, 7) AS month, ROUND(SUM(amount), 2) AS collected
       FROM payments
       GROUP BY substr(payment_date, 1, 7)
       ORDER BY month DESC
       LIMIT 6`
    )
    .all();

  res.json({
    kpis: {
      drones,
      missions,
      clients,
      invoicesOpen,
      receivable,
      overdue,
      insuranceExpiring,
      maintenanceDue
    },
    topDrones,
    cashflow
  });
});

router.get("/reminders", authRequired, (req, res) => {
  refreshAutomaticReminders();
  const reminders = db.prepare("SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_date ASC").all();
  res.json(reminders);
});

module.exports = router;
