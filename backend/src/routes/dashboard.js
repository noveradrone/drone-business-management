const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");
const { computeMissionFinancials } = require("../services/missionMetrics");

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

  const missionRows = db
    .prepare(
      `SELECT
         m.id,
         m.mission_date,
         m.preparation_hours,
         m.flight_time_hours,
         m.flight_hours_logged,
         m.montage_hours,
         m.variable_costs,
         c.company_name,
         (
           SELECT COALESCE(SUM(i.total), 0)
           FROM invoices i
           WHERE i.mission_id = m.id
         ) AS mission_revenue
       FROM missions m
       JOIN clients c ON c.id = m.client_id
       ORDER BY m.mission_date DESC`
    )
    .all();

  const enrichedMissions = missionRows.map((mission) => ({
    ...mission,
    ...computeMissionFinancials(mission, mission.mission_revenue)
  }));
  const mostProfitableMission = enrichedMissions
    .slice()
    .sort((a, b) => b.gross_margin - a.gross_margin)[0] || null;

  const averageBasket = db.prepare("SELECT COALESCE(AVG(total), 0) AS value FROM invoices").get().value || 0;
  const revenueCurrentMonth =
    db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM invoices
         WHERE substr(invoice_date, 1, 7) = strftime('%Y-%m', 'now')`
      )
      .get().value || 0;

  const revenueLast12Months =
    db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM invoices
         WHERE invoice_date >= date('now', '-12 months')`
      )
      .get().value || 0;

  const monthlyTarget =
    db.prepare("SELECT monthly_revenue_target FROM company_settings WHERE id = 1").get()
      ?.monthly_revenue_target || 0;
  const targetProgressPercent = monthlyTarget > 0 ? (revenueCurrentMonth * 100) / monthlyTarget : 0;

  const maintenanceAlerts = db
    .prepare(
      `SELECT
         id,
         brand,
         model,
         serial_number,
         total_cycles,
         battery_cycle_threshold,
         total_flight_hours,
         propeller_hours_threshold
       FROM drones
       WHERE total_cycles >= COALESCE(battery_cycle_threshold, 300)
          OR total_flight_hours >= COALESCE(propeller_hours_threshold, 120)
       ORDER BY total_cycles DESC, total_flight_hours DESC`
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
      maintenanceDue,
      averageBasket: Number(averageBasket.toFixed(2)),
      revenueCurrentMonth: Number(revenueCurrentMonth.toFixed(2)),
      revenueLast12Months: Number(revenueLast12Months.toFixed(2)),
      monthlyTarget: Number(Number(monthlyTarget || 0).toFixed(2)),
      targetProgressPercent: Number(targetProgressPercent.toFixed(2))
    },
    topDrones,
    cashflow,
    mostProfitableMission: mostProfitableMission
      ? {
          id: mostProfitableMission.id,
          mission_date: mostProfitableMission.mission_date,
          company_name: mostProfitableMission.company_name,
          gross_margin: Number(mostProfitableMission.gross_margin.toFixed(2)),
          mission_revenue: Number(Number(mostProfitableMission.mission_revenue || 0).toFixed(2))
        }
      : null,
    maintenanceAlerts
  });
});

router.get("/reminders", authRequired, (req, res) => {
  refreshAutomaticReminders();
  const reminders = db.prepare("SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_date ASC").all();
  res.json(reminders);
});

module.exports = router;
