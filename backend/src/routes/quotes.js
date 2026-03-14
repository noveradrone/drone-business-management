const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { buildQuotePdf } = require("../utils/pdf");
const { nextInvoiceNumber } = require("../services/invoiceFinance");
const {
  toNumber,
  normalizeQuoteStatus,
  nextQuoteNumber,
  calculateQuoteTotals
} = require("../services/quoteFinance");

const router = express.Router();

function syncQuoteStatuses() {
  const rows = db.prepare("SELECT id, status, valid_until FROM quotes").all();
  const update = db.prepare("UPDATE quotes SET status = ? WHERE id = ?");
  rows.forEach((row) => {
    const normalized = normalizeQuoteStatus(row.status, row.valid_until);
    if (normalized !== row.status) update.run(normalized, row.id);
  });
}

router.get("/next-number", authRequired, (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  res.json({ quote_number: nextQuoteNumber(date) });
});

router.get("/stats", authRequired, (req, res) => {
  syncQuoteStatuses();
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_quotes,
         COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS sent_quotes,
         COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted_quotes,
         COALESCE(SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END), 0) AS expired_quotes,
         COALESCE(SUM(total), 0) AS total_amount
       FROM quotes`
    )
    .get();
  res.json(stats);
});

router.get("/", authRequired, (req, res) => {
  syncQuoteStatuses();
  const query = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const minAmount = req.query.min ? toNumber(req.query.min, 0) : null;
  const maxAmount = req.query.max ? toNumber(req.query.max, 0) : null;

  const rows = db
    .prepare(
      `SELECT q.*, c.company_name
       FROM quotes q
       JOIN clients c ON c.id = q.client_id
       ORDER BY q.quote_date DESC`
    )
    .all()
    .filter((row) => {
      if (query) {
        const hay = `${row.quote_number} ${row.company_name}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (status && status !== "all" && row.status !== status) return false;
      if (from && row.quote_date < from) return false;
      if (to && row.quote_date > to) return false;
      if (minAmount !== null && toNumber(row.total, 0) < minAmount) return false;
      if (maxAmount !== null && toNumber(row.total, 0) > maxAmount) return false;
      return true;
    });

  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const {
    client_id,
    quote_number,
    quote_date,
    valid_until,
    status,
    tax_rate,
    currency,
    discount_percent,
    discount_amount,
    acompte_percent,
    acompte_amount,
    notes,
    items = []
  } = req.body;

  if (!client_id || !quote_date) {
    return res.status(400).json({ message: "client_id and quote_date are required" });
  }

  const settings = db.prepare("SELECT quote_validity_days FROM company_settings WHERE id = 1").get() || {};
  const validityDays = Number(settings.quote_validity_days || 30);
  const autoValidUntil = new Date(new Date(quote_date).getTime() + validityDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const finalValidUntil = valid_until || autoValidUntil;
  const finalStatus = normalizeQuoteStatus(status || "draft", finalValidUntil);
  const finalNumber = quote_number || nextQuoteNumber(quote_date);

  const totals = calculateQuoteTotals(
    items,
    tax_rate,
    discount_percent,
    discount_amount,
    acompte_percent,
    acompte_amount
  );

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO quotes (
          client_id, quote_number, quote_date, valid_until, status, subtotal, tax_rate, total, notes, currency,
          discount_percent, discount_amount, subtotal_after_discount, acompte_percent, acompte_amount, estimated_balance, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        client_id,
        finalNumber,
        quote_date,
        finalValidUntil || null,
        finalStatus,
        totals.subtotal,
        toNumber(tax_rate, 0),
        totals.total,
        notes || null,
        currency || "EUR",
        totals.discount_percent,
        totals.discount_amount,
        totals.subtotal_after_discount,
        totals.acompte_percent,
        totals.acompte_amount,
        totals.estimated_balance,
        finalStatus === "sent" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null
      );

    const quoteId = result.lastInsertRowid;
    const itemInsert = db.prepare(
      `INSERT INTO quote_items (quote_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?)`
    );

    totals.normalizedItems.forEach((item) => {
      itemInsert.run(quoteId, item.description, item.quantity, item.unit_price, item.total);
    });

    return quoteId;
  });

  try {
    const quoteId = tx();
    const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
    const quoteItems = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(quoteId);
    res.status(201).json({ ...quote, items: quoteItems });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", authRequired, (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });

  const payload = req.body || {};
  const quoteDate = payload.quote_date || quote.quote_date;
  const validUntil = payload.valid_until !== undefined ? payload.valid_until : quote.valid_until;
  const finalStatus = normalizeQuoteStatus(payload.status || quote.status, validUntil);
  const finalNumber = payload.quote_number || quote.quote_number;
  const clientId = payload.client_id !== undefined ? Number(payload.client_id) : quote.client_id;
  const taxRate = payload.tax_rate !== undefined ? toNumber(payload.tax_rate, 0) : quote.tax_rate;
  const currency = payload.currency || quote.currency || "EUR";
  const notes = payload.notes !== undefined ? payload.notes : quote.notes;
  const items = Array.isArray(payload.items) && payload.items.length
    ? payload.items
    : db.prepare("SELECT description, quantity, unit_price FROM quote_items WHERE quote_id = ?").all(req.params.id);

  if (!clientId || !quoteDate) {
    return res.status(400).json({ message: "client_id and quote_date are required" });
  }

  const totals = calculateQuoteTotals(
    items,
    taxRate,
    payload.discount_percent !== undefined ? payload.discount_percent : quote.discount_percent,
    payload.discount_amount !== undefined ? payload.discount_amount : quote.discount_amount,
    payload.acompte_percent !== undefined ? payload.acompte_percent : quote.acompte_percent,
    payload.acompte_amount !== undefined ? payload.acompte_amount : quote.acompte_amount
  );

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE quotes
       SET client_id = ?, quote_number = ?, quote_date = ?, valid_until = ?, status = ?,
           subtotal = ?, tax_rate = ?, total = ?, notes = ?, currency = ?,
           discount_percent = ?, discount_amount = ?, subtotal_after_discount = ?,
           acompte_percent = ?, acompte_amount = ?, estimated_balance = ?,
           sent_at = CASE
             WHEN ? = 'sent' AND sent_at IS NULL THEN datetime('now')
             WHEN ? != 'sent' THEN NULL
             ELSE sent_at
           END
       WHERE id = ?`
    ).run(
      clientId,
      finalNumber,
      quoteDate,
      validUntil,
      finalStatus,
      totals.subtotal,
      taxRate,
      totals.total,
      notes,
      currency,
      totals.discount_percent,
      totals.discount_amount,
      totals.subtotal_after_discount,
      totals.acompte_percent,
      totals.acompte_amount,
      totals.estimated_balance,
      finalStatus,
      finalStatus,
      req.params.id
    );

    db.prepare("DELETE FROM quote_items WHERE quote_id = ?").run(req.params.id);
    const itemInsert = db.prepare(
      `INSERT INTO quote_items (quote_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?)`
    );
    totals.normalizedItems.forEach((item) => {
      itemInsert.run(req.params.id, item.description, item.quantity, item.unit_price, item.total);
    });
  });

  try {
    tx();
    const updated = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
    const updatedItems = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(req.params.id);
    res.json({ ...updated, items: updatedItems });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/:id/send", authRequired, (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });
  const status = normalizeQuoteStatus("sent", quote.valid_until);
  db.prepare("UPDATE quotes SET status = ?, sent_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  const updated = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  res.json({
    quote: updated,
    message: "Devis marqué comme envoyé. Branchez un provider SMTP pour l’envoi email réel."
  });
});

router.post("/:id/convert-to-invoice", authRequired, (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });

  const status = normalizeQuoteStatus(quote.status, quote.valid_until);
  if (status !== "accepted") {
    return res.status(400).json({ message: "Seul un devis accepté peut être converti en facture." });
  }

  const existingLink = db.prepare("SELECT id, invoice_number FROM invoices WHERE quote_id = ?").get(req.params.id);
  if (existingLink) return res.status(400).json({ message: `Ce devis est déjà lié à ${existingLink.invoice_number}.` });

  const items = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(req.params.id);
  if (!items.length) return res.status(400).json({ message: "Impossible de convertir un devis sans ligne." });

  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const invoiceNumber = nextInvoiceNumber(invoiceDate);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO invoices (
          client_id, mission_id, quote_id, invoice_number, invoice_date, due_date,
          status, subtotal, tax_rate, total, amount_received, currency, notes,
          acompte_pourcentage, acompte_montant, solde_restant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        quote.client_id,
        null,
        quote.id,
        invoiceNumber,
        invoiceDate,
        dueDate,
        "sent",
        quote.subtotal || 0,
        quote.tax_rate || 0,
        quote.total || 0,
        0,
        quote.currency || "EUR",
        quote.notes || null,
        quote.acompte_percent || 0,
        quote.acompte_amount || 0,
        quote.estimated_balance || quote.total || 0
      );

    const invoiceId = result.lastInsertRowid;
    const itemInsert = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?)`
    );
    items.forEach((item) => {
      itemInsert.run(invoiceId, item.description, item.quantity, item.unit_price, item.total);
    });
    return invoiceId;
  });

  const invoiceId = tx();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  res.status(201).json({ invoice });
});

router.get("/:id", authRequired, (req, res) => {
  syncQuoteStatuses();
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });
  const items = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(req.params.id);
  res.json({ ...quote, items });
});

router.get("/:id/pdf", authRequired, async (req, res) => {
  syncQuoteStatuses();
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });
  const items = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(req.params.id);
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(quote.client_id);
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};

  const pdf = await buildQuotePdf(quote, items, client, settings);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=quote-${quote.quote_number}.pdf`);
  res.send(pdf);
});

router.delete("/:id", authRequired, (req, res) => {
  try {
    const result = db.prepare("DELETE FROM quotes WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Quote not found" });
    return res.status(204).send();
  } catch (error) {
    return res.status(409).json({ message: "Quote cannot be deleted because it is still referenced" });
  }
});

module.exports = router;
