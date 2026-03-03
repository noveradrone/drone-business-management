const db = require("../db");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeQuoteStatus(rawStatus, validUntil) {
  const status = String(rawStatus || "draft").toLowerCase();
  const mapped = {
    brouillon: "draft",
    envoye: "sent",
    accepte: "accepted",
    refuse: "rejected",
    expired: "expired",
    draft: "draft",
    sent: "sent",
    accepted: "accepted",
    rejected: "rejected"
  }[status] || "draft";

  if (mapped === "accepted" || mapped === "rejected") return mapped;
  const today = new Date().toISOString().slice(0, 10);
  if (validUntil && validUntil < today) return "expired";
  return mapped;
}

function nextQuoteNumber(dateValue = new Date().toISOString().slice(0, 10)) {
  const year = String(dateValue).slice(0, 4);
  const like = `QUO-${year}-%`;
  const row = db
    .prepare(
      `SELECT quote_number
       FROM quotes
       WHERE quote_number LIKE ?
       ORDER BY quote_number DESC
       LIMIT 1`
    )
    .get(like);
  const current = row ? Number(String(row.quote_number).split("-")[2] || 0) : 0;
  const next = String(current + 1).padStart(4, "0");
  return `QUO-${year}-${next}`;
}

function calculateQuoteTotals(items, taxRate = 0, discountPercent = 0, discountAmount = 0, acomptePercent = 0, acompteAmount = 0) {
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
  const pct = Math.max(0, toNumber(discountPercent, 0));
  let discount = Math.max(0, toNumber(discountAmount, 0));
  if (!discount && pct > 0) discount = (subtotal * pct) / 100;
  if (discount > subtotal) discount = subtotal;
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const total = subtotalAfterDiscount + (subtotalAfterDiscount * toNumber(taxRate, 0)) / 100;

  const acomptePct = Math.max(0, toNumber(acomptePercent, 0));
  let upfront = Math.max(0, toNumber(acompteAmount, 0));
  if (!upfront && acomptePct > 0) upfront = (total * acomptePct) / 100;
  if (upfront > total) upfront = total;
  const balance = Math.max(0, total - upfront);

  return {
    normalizedItems,
    subtotal,
    discount_percent: pct,
    discount_amount: discount,
    subtotal_after_discount: subtotalAfterDiscount,
    total,
    acompte_percent: acomptePct,
    acompte_amount: upfront,
    estimated_balance: balance
  };
}

module.exports = {
  toNumber,
  normalizeQuoteStatus,
  nextQuoteNumber,
  calculateQuoteTotals
};
