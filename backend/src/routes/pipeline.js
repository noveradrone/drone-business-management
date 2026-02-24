const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         p.*,
         c.company_name,
         c.contact_name,
         c.phone,
         c.email,
         c.source_channel
       FROM commercial_pipeline p
       JOIN clients c ON c.id = p.client_id
       ORDER BY p.updated_at DESC`
    )
    .all();
  res.json(rows);
});

router.post("/upsert", authRequired, (req, res) => {
  const { client_id, status = "prospect", source, notes } = req.body;
  if (!client_id) return res.status(400).json({ message: "client_id est requis" });

  const client = db.prepare("SELECT id FROM clients WHERE id = ?").get(client_id);
  if (!client) return res.status(404).json({ message: "Client introuvable" });

  db.prepare(
    `INSERT INTO commercial_pipeline (client_id, status, source, notes, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(client_id) DO UPDATE SET
       status = excluded.status,
       source = COALESCE(excluded.source, commercial_pipeline.source),
       notes = COALESCE(excluded.notes, commercial_pipeline.notes),
       updated_at = datetime('now')`
  ).run(client_id, status, source || null, notes || null);

  const row = db.prepare("SELECT * FROM commercial_pipeline WHERE client_id = ?").get(client_id);
  res.json(row);
});

router.get("/stats", authRequired, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS count FROM commercial_pipeline").get().count || 0;
  const accepted = db
    .prepare("SELECT COUNT(*) AS count FROM commercial_pipeline WHERE status = 'accepted'")
    .get().count || 0;
  const conversionGlobal = total ? (accepted * 100) / total : 0;

  const conversionBySource = db
    .prepare(
      `SELECT
         COALESCE(source, c.source_channel, 'inconnu') AS source,
         ROUND(100.0 * SUM(CASE WHEN p.status = 'accepted' THEN 1 ELSE 0 END) / COUNT(*), 2) AS conversion_rate,
         COUNT(*) AS total
       FROM commercial_pipeline p
       JOIN clients c ON c.id = p.client_id
       GROUP BY COALESCE(source, c.source_channel, 'inconnu')
       ORDER BY total DESC`
    )
    .all();

  const prospectsByMonth = db
    .prepare(
      `SELECT
         substr(created_at, 1, 7) AS month,
         COUNT(*) AS prospects
       FROM commercial_pipeline
       GROUP BY substr(created_at, 1, 7)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all();

  res.json({
    conversion_global: Number(conversionGlobal.toFixed(2)),
    conversion_by_source: conversionBySource,
    prospects_by_month: prospectsByMonth
  });
});

module.exports = router;
