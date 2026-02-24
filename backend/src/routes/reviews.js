const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { sendSms } = require("../services/twilioService");
const { googleReviewLink } = require("../config");

const router = express.Router();

function syncEligibleClients() {
  const candidates = db
    .prepare(
      `SELECT
         m.id AS mission_id,
         m.client_id,
         m.mission_date,
         c.phone
       FROM missions m
       JOIN clients c ON c.id = m.client_id
       WHERE m.mission_status = 'completed'
         AND m.avis_demande = 0
         AND date(m.mission_date) <= date('now', '-3 day')
         AND c.phone IS NOT NULL
         AND trim(c.phone) != ''`
    )
    .all();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO clients_a_relancer (client_id, mission_id, phone, mission_date)
     VALUES (?, ?, ?, ?)`
  );

  for (const row of candidates) {
    insert.run(row.client_id, row.mission_id, row.phone, row.mission_date);
  }
}

router.post("/refresh", authRequired, (req, res) => {
  syncEligibleClients();
  res.json({ message: "Liste des clients a relancer mise a jour" });
});

router.get("/eligible", authRequired, (req, res) => {
  syncEligibleClients();
  const rows = db
    .prepare(
      `SELECT
         r.*,
         c.company_name,
         c.contact_name
       FROM clients_a_relancer r
       JOIN clients c ON c.id = r.client_id
       WHERE r.avis_demande = 0
       ORDER BY r.mission_date DESC`
    )
    .all();
  res.json(rows);
});

router.post("/send/:id", authRequired, async (req, res) => {
  const queueItem = db.prepare("SELECT * FROM clients_a_relancer WHERE id = ?").get(req.params.id);
  if (!queueItem) return res.status(404).json({ message: "Relance introuvable" });
  if (queueItem.avis_demande) return res.status(400).json({ message: "Demande deja envoyee" });

  const lastRelanceAt = queueItem.last_relance_at ? new Date(queueItem.last_relance_at) : null;
  if (lastRelanceAt) {
    const diffDays = (Date.now() - lastRelanceAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      return res.status(429).json({ message: "Une seule relance est autorisee tous les 7 jours" });
    }
  }

  const client = db
    .prepare("SELECT company_name, contact_name, phone FROM clients WHERE id = ?")
    .get(queueItem.client_id);
  if (!client || !client.phone) return res.status(400).json({ message: "Numero client manquant" });

  const firstName = (client.contact_name || client.company_name || "client")
    .trim()
    .split(" ")[0];
  const reviewLink = googleReviewLink || "LIEN_GOOGLE_REVIEW";
  const message = `Bonjour ${firstName}, merci encore pour votre confiance pour votre projet drone. Si vous avez 30 secondes, un avis sur ma fiche Google m'aiderait enormement 🙏 ${reviewLink}`;

  try {
    await sendSms(client.phone, message);

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE clients_a_relancer
         SET avis_demande = 1,
             date_demande = datetime('now'),
             compteur_relances = compteur_relances + 1,
             last_relance_at = datetime('now')
         WHERE id = ?`
      ).run(queueItem.id);

      db.prepare(
        `UPDATE missions
         SET avis_demande = 1,
             date_avis_demande = datetime('now'),
             avis_relances_count = avis_relances_count + 1
         WHERE id = ?`
      ).run(queueItem.mission_id);
    });

    tx();
    return res.json({ message: "Demande d'avis envoyee" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
