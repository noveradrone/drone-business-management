const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", authRequired, (req, res) => {
  const paidAndOpen = db
    .prepare(
      `SELECT
         substr(invoice_date, 1, 7) AS month,
         ROUND(SUM(total), 2) AS revenue
       FROM invoices
       WHERE invoice_date >= date('now', '-12 months')
       GROUP BY substr(invoice_date, 1, 7)
       ORDER BY month ASC`
    )
    .all();

  const probableMissions = db
    .prepare(
      `SELECT COUNT(*) AS count FROM quotes
       WHERE status IN ('sent','accepted')
         AND quote_date >= date('now', '-3 months')`
    )
    .get().count;

  const estimatedRevenue3Months = db
    .prepare(
      `SELECT
         ROUND(COALESCE(SUM(
           CASE
             WHEN status = 'accepted' THEN total
             WHEN status = 'sent' THEN total * 0.45
             ELSE 0
           END
         ), 0), 2) AS value
       FROM quotes
       WHERE quote_date >= date('now', '-3 months')`
    )
    .get().value;

  const seasonality = db
    .prepare(
      `SELECT
         strftime('%m', mission_date) AS month,
         COUNT(*) AS missions
       FROM missions
       WHERE mission_date >= date('now', '-24 months')
       GROUP BY strftime('%m', mission_date)
       ORDER BY month ASC`
    )
    .all();

  const missionsByDepartment = db
    .prepare(
      `SELECT
         COALESCE(NULLIF(trim(department), ''), 'Non renseigne') AS department,
         COUNT(*) AS missions
       FROM missions
       GROUP BY COALESCE(NULLIF(trim(department), ''), 'Non renseigne')
       ORDER BY missions DESC`
    )
    .all();

  res.json({
    estimated_revenue_3_months: Number(estimatedRevenue3Months || 0),
    probable_missions: probableMissions || 0,
    historical_revenue: paidAndOpen,
    seasonality,
    missions_by_department: missionsByDepartment
  });
});

module.exports = router;
