const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { buildQuotePdf } = require("../utils/pdf");

const router = express.Router();

function calculateTotals(items, taxRate = 0) {
  const normalizedItems = (items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    return {
      description: item.description,
      quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + (subtotal * Number(taxRate || 0)) / 100;
  return { normalizedItems, subtotal, total };
}

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT q.*, c.company_name
       FROM quotes q
       JOIN clients c ON c.id = q.client_id
       ORDER BY q.quote_date DESC`
    )
    .all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const { client_id, quote_number, quote_date, valid_until, status, tax_rate, notes, items = [] } = req.body;
  if (!client_id || !quote_number || !quote_date) {
    return res.status(400).json({ message: "client_id, quote_number and quote_date are required" });
  }

  const { normalizedItems, subtotal, total } = calculateTotals(items, tax_rate);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO quotes (client_id, quote_number, quote_date, valid_until, status, subtotal, tax_rate, total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        client_id,
        quote_number,
        quote_date,
        valid_until || null,
        status || "draft",
        subtotal,
        Number(tax_rate || 0),
        total,
        notes || null
      );

    const quoteId = result.lastInsertRowid;
    const itemInsert = db.prepare(
      `INSERT INTO quote_items (quote_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?)`
    );

    normalizedItems.forEach((item) => {
      itemInsert.run(quoteId, item.description, item.quantity, item.unit_price, item.total);
    });

    return quoteId;
  });

  const quoteId = tx();
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
  const quoteItems = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(quoteId);
  res.status(201).json({ ...quote, items: quoteItems });
});

router.get("/:id", authRequired, (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found" });
  const items = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(req.params.id);
  res.json({ ...quote, items });
});

router.get("/:id/pdf", authRequired, async (req, res) => {
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
