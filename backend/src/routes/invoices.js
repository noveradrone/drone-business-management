const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { refreshAutomaticReminders } = require("../services/reminders");
const { buildInvoicePdf, buildPaymentReceiptPdf } = require("../utils/pdf");

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
      `SELECT i.*, c.company_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       ORDER BY i.invoice_date DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", authRequired, (req, res) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id);
  const payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC").all(req.params.id);
  res.json({ ...invoice, items, payments });
});

router.post("/", authRequired, (req, res) => {
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
    items = []
  } = req.body;

  if (!client_id || !invoice_number || !invoice_date || !due_date) {
    return res.status(400).json({
      message: "client_id, invoice_number, invoice_date and due_date are required"
    });
  }

  const { normalizedItems, subtotal, total } = calculateTotals(items, tax_rate);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO invoices (
          client_id, mission_id, quote_id, invoice_number, invoice_date, due_date,
          status, subtotal, tax_rate, total, currency, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        client_id,
        mission_id || null,
        quote_id || null,
        invoice_number,
        invoice_date,
        due_date,
        status || "draft",
        subtotal,
        Number(tax_rate || 0),
        total,
        currency || "EUR",
        notes || null
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

  const invoiceId = tx();
  refreshAutomaticReminders();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  const invoiceItems = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(invoiceId);
  res.status(201).json({ ...invoice, items: invoiceItems });
});

router.post("/:id/payments", authRequired, (req, res) => {
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

    let status = invoice.status;
    if (amountReceived >= invoice.total) status = "paid";
    else if (amountReceived > 0) status = "partial";
    else if (invoice.due_date < new Date().toISOString().slice(0, 10)) status = "overdue";

    db.prepare("UPDATE invoices SET amount_received = ?, status = ? WHERE id = ?").run(
      amountReceived,
      status,
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
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  const payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC").all(req.params.id);
  res.status(201).json({ invoice, payments });
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

  const pdf = await buildInvoicePdf(invoice, items, client, settings);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
  res.send(pdf);
});

module.exports = router;
