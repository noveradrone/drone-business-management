const db = require("../db");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calculateTotals(items, taxRate = 0) {
  const normalizedItems = (items || []).map((item) => {
    const quantity = toNumber(item.quantity, 0);
    const unitPrice = toNumber(item.unit_price, 0);
    return {
      description: item.description,
      quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + (subtotal * toNumber(taxRate, 0)) / 100;
  return { normalizedItems, subtotal, total };
}

function computeAcompte(total, acomptePourcentage, acompteMontant) {
  const t = toNumber(total, 0);
  const pct = toNumber(acomptePourcentage, 0);
  let upfront = toNumber(acompteMontant, 0);
  if (!upfront && pct > 0) upfront = (t * pct) / 100;
  if (upfront > t) upfront = t;
  if (upfront < 0) upfront = 0;
  const balance = Math.max(0, t - upfront);
  return {
    acompte_pourcentage: pct,
    acompte_montant: upfront,
    solde_restant: balance
  };
}

function normalizeInvoiceStatus(invoice) {
  const today = new Date().toISOString().slice(0, 10);
  const due = Math.max(0, toNumber(invoice.total) - toNumber(invoice.amount_received));
  if (due <= 0) return "paid";
  if (invoice.due_date && invoice.due_date < today) return "overdue";
  if (toNumber(invoice.amount_received) > 0) return "partial";
  if (invoice.status === "draft") return "draft";
  return "sent";
}

function nextInvoiceNumber(dateValue = new Date().toISOString().slice(0, 10)) {
  const year = String(dateValue).slice(0, 4);
  const like = `FACT-${year}-%`;
  const row = db
    .prepare(
      `SELECT invoice_number
       FROM invoices
       WHERE invoice_number LIKE ?
       ORDER BY invoice_number DESC
       LIMIT 1`
    )
    .get(like);
  const current = row ? Number(String(row.invoice_number).split("-")[2] || 0) : 0;
  const next = String(current + 1).padStart(4, "0");
  return `FACT-${year}-${next}`;
}

function computeMissionProfitability(invoiceId) {
  const row = db
    .prepare(
      `SELECT
         i.id,
         i.mission_id,
         i.total AS invoice_total,
         m.variable_costs
       FROM invoices i
       LEFT JOIN missions m ON m.id = i.mission_id
       WHERE i.id = ?`
    )
    .get(invoiceId);
  if (!row || !row.mission_id) return null;
  const cost = toNumber(row.variable_costs, 0);
  const revenue = toNumber(row.invoice_total, 0);
  const margin = revenue - cost;
  const percent = revenue > 0 ? (margin * 100) / revenue : 0;
  return {
    cost_estimated: Number(cost.toFixed(2)),
    gross_margin: Number(margin.toFixed(2)),
    margin_percent: Number(percent.toFixed(2))
  };
}

module.exports = {
  toNumber,
  calculateTotals,
  computeAcompte,
  normalizeInvoiceStatus,
  nextInvoiceNumber,
  computeMissionProfitability
};
