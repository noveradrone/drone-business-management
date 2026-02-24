const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");
const { processOverdueReminders } = require("../services/invoiceReminders");
const {
  toNumber,
  calculateTotals,
  computeAcompte,
  normalizeInvoiceStatus,
  nextInvoiceNumber,
  computeMissionProfitability
} = require("../services/invoiceFinance");
const { buildInvoicePdf, buildPaymentReceiptPdf } = require("../utils/pdf");

const router = express.Router();

function hideInternal(invoice, role) {
  if (role === "admin") return invoice;
  const clone = { ...invoice };
  delete clone.note_interne;
  return clone;
}

function syncInvoiceStatuses() {
  const rows = db.prepare("SELECT id, status, due_date, total, amount_received FROM invoices").all();
  const update = db.prepare("UPDATE invoices SET status = ?, solde_restant = ? WHERE id = ?");
  rows.forEach((row) => {
    const status = normalizeInvoiceStatus(row);
    const solde = Math.max(0, toNumber(row.total) - toNumber(row.amount_received));
    update.run(status, solde, row.id);
  });
}

router.get("/next-number", authRequired, (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  res.json({ invoice_number: nextInvoiceNumber(date) });
});

router.get("/stats", authRequired, async (req, res) => {
  syncInvoiceStatuses();
  await processOverdueReminders();

  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(total), 0) AS total_facture,
         COALESCE(SUM(amount_received), 0) AS total_encaisse,
         COALESCE(SUM(total - amount_received), 0) AS total_restant,
         SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS factures_en_retard
       FROM invoices`
    )
    .get();

  const averageDelay = db
    .prepare(
      `SELECT AVG(julianday(MAX(p.payment_date)) - julianday(i.invoice_date)) AS value
       FROM invoices i
       JOIN payments p ON p.invoice_id = i.id
       GROUP BY i.id`
    )
    .all();
  const avg = averageDelay.length
    ? averageDelay.reduce((sum, r) => sum + toNumber(r.value), 0) / averageDelay.length
    : 0;

  const monthlyCollections = db
    .prepare(
      `SELECT substr(payment_date, 1, 7) AS month, ROUND(SUM(amount), 2) AS amount
       FROM payments
       GROUP BY substr(payment_date, 1, 7)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all();

  const unpaidMonthly = db
    .prepare(
      `SELECT substr(invoice_date, 1, 7) AS month, ROUND(SUM(total - amount_received), 2) AS unpaid
       FROM invoices
       WHERE (total - amount_received) > 0
       GROUP BY substr(invoice_date, 1, 7)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all();

  res.json({
    ...totals,
    delai_moyen_paiement: Number(avg.toFixed(2)),
    encaissements_mensuels: monthlyCollections,
    impayes_mensuels: unpaidMonthly
  });
});

router.get("/", authRequired, async (req, res) => {
  syncInvoiceStatuses();
  await processOverdueReminders();
  const rows = db
    .prepare(
      `SELECT i.*, c.company_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       ORDER BY i.invoice_date DESC`
    )
    .all()
    .map((row) => hideInternal(row, req.user.role));
  res.json(rows);
});

router.get("/:id", authRequired, async (req, res) => {
  syncInvoiceStatuses();
  await processOverdueReminders();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id);
  const payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC").all(req.params.id);
  const profitability = computeMissionProfitability(req.params.id);
  res.json({ ...hideInternal(invoice, req.user.role), items, payments, profitability });
});

router.post("/", authRequired, async (req, res) => {
  const {
    client_id,
    mission_id,
    quote_id,
    invoice_number,
    invoice_date,
    due_date,
    status,
    tax_rate,
    currency,
    notes,
    note_interne,
    acompte_pourcentage,
    acompte_montant,
    items = []
  } = req.body;

  if (!client_id || !invoice_date || !due_date) {
    return res.status(400).json({
      message: "client_id, invoice_date and due_date are required"
    });
  }

  const finalNumber = invoice_number || nextInvoiceNumber(invoice_date);
  const { normalizedItems, subtotal, total } = calculateTotals(items, tax_rate);
  const acompte = computeAcompte(total, acompte_pourcentage, acompte_montant);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO invoices (
          client_id, mission_id, quote_id, invoice_number, invoice_date, due_date,
          status, subtotal, tax_rate, total, currency, notes, note_interne,
          acompte_pourcentage, acompte_montant, solde_restant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        client_id,
        mission_id || null,
        quote_id || null,
        finalNumber,
        invoice_date,
        due_date,
        status || "draft",
        subtotal,
        toNumber(tax_rate, 0),
        total,
        currency || "EUR",
        notes || null,
        req.user.role === "admin" ? note_interne || null : null,
        acompte.acompte_pourcentage,
        acompte.acompte_montant,
        acompte.solde_restant
      );

    const invoiceId = result.lastInsertRowid;
    const itemInsert = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?)`
    );

    normalizedItems.forEach((item) => {
      itemInsert.run(invoiceId, item.description, item.quantity, item.unit_price, item.total);
    });

    return invoiceId;
  });

  try {
    const invoiceId = tx();
    syncInvoiceStatuses();
    refreshAutomaticReminders();
    await processOverdueReminders();
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    const invoiceItems = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(invoiceId);
    return res.status(201).json({ ...hideInternal(invoice, req.user.role), items: invoiceItems });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post("/:id/payments", authRequired, async (req, res) => {
  const { payment_date, amount, method, reference, notes } = req.body;
  if (!payment_date || !amount) {
    return res.status(400).json({ message: "payment_date and amount are required" });
  }

  const tx = db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
    if (!invoice) throw new Error("Invoice not found");

    db.prepare(
      `INSERT INTO payments (invoice_id, payment_date, amount, method, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, payment_date, amount, method || null, reference || null, notes || null);

    const amountReceived = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total_received FROM payments WHERE invoice_id = ?")
      .get(req.params.id).total_received;

    const status = normalizeInvoiceStatus({
      ...invoice,
      amount_received: amountReceived
    });

    db.prepare(
      `UPDATE invoices
       SET amount_received = ?,
           solde_restant = ?,
           status = ?,
           date_paiement = CASE WHEN ? = 'paid' THEN ? ELSE date_paiement END,
           moyen_paiement = CASE WHEN ? = 'paid' THEN COALESCE(?, moyen_paiement) ELSE moyen_paiement END
       WHERE id = ?`
    ).run(
      amountReceived,
      Math.max(0, toNumber(invoice.total) - toNumber(amountReceived)),
      status,
      status,
      status === "paid" ? payment_date : null,
      status,
      method || null,
      req.params.id
    );
  });

  try {
    tx();
  } catch (error) {
    if (error.message === "Invoice not found") return res.status(404).json({ message: error.message });
    return res.status(400).json({ message: error.message });
  }

  refreshAutomaticReminders();
  await processOverdueReminders();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  const payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC").all(req.params.id);
  res.status(201).json({ invoice: hideInternal(invoice, req.user.role), payments });
});

router.post("/:id/mark-paid", authRequired, async (req, res) => {
  const { date_paiement, moyen_paiement = "autre", reference, notes } = req.body || {};
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  const today = new Date().toISOString().slice(0, 10);
  const paymentDate = date_paiement || today;
  const due = Math.max(0, toNumber(invoice.total) - toNumber(invoice.amount_received));
  if (due <= 0) return res.status(400).json({ message: "Invoice is already fully paid" });

  db.prepare(
    `INSERT INTO payments (invoice_id, payment_date, amount, method, reference, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.params.id, paymentDate, due, moyen_paiement, reference || "MARK-PAID", notes || null);

  db.prepare(
    `UPDATE invoices
     SET amount_received = total,
         solde_restant = 0,
         status = 'paid',
         date_paiement = ?,
         moyen_paiement = ?
     WHERE id = ?`
  ).run(paymentDate, moyen_paiement, req.params.id);

  refreshAutomaticReminders();
  await processOverdueReminders();
  const updated = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  const lastPayment = db
    .prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1")
    .get(req.params.id);
  res.json({ invoice: hideInternal(updated, req.user.role), payment: lastPayment });
});

router.get("/:id/payments/:paymentId/receipt-pdf", authRequired, async (req, res) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ? AND invoice_id = ?")
    .get(req.params.paymentId, req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found for this invoice" });

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(invoice.client_id);
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};
  const pdf = await buildPaymentReceiptPdf(invoice, payment, client, settings);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=receipt-${invoice.invoice_number}-${payment.id}.pdf`
  );
  res.send(pdf);
});

router.get("/:id/pdf", authRequired, async (req, res) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id);
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(invoice.client_id);
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};
  const profitability = computeMissionProfitability(req.params.id);

  const pdf = await buildInvoicePdf(invoice, items, client, settings, profitability);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
  res.send(pdf);
});

router.delete("/:id", authRequired, (req, res) => {
  const result = db.prepare("DELETE FROM invoices WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Invoice not found" });
  refreshAutomaticReminders();
  return res.status(204).send();
});

module.exports = router;
