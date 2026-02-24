const db = require("../db");
const { sendSms } = require("./twilioService");

function daysBetween(olderDate, newerDate) {
  const a = new Date(olderDate);
  const b = new Date(newerDate);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function sendInvoiceReminder(invoice, client, relanceType, options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (invoice.last_relance_date === today) {
    return { skipped: true, reason: "already_sent_today" };
  }

  const due = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_received || 0));
  const message = `Relance facture ${invoice.invoice_number}: montant restant ${due.toFixed(2)} ${invoice.currency || "EUR"}, echeance ${invoice.due_date}.`;

  // Email sending hook (no SMTP dependency in this project).
  console.log(`[AUTO-EMAIL][${relanceType}] to=${client.email || "n/a"} ${message}`);

  if (options.sendSms && client.phone) {
    try {
      await sendSms(client.phone, message);
    } catch (error) {
      console.warn("Invoice reminder SMS failed:", error.message);
    }
  }

  db.prepare(
    `INSERT INTO invoice_relances (invoice_id, relance_type, channel, message)
     VALUES (?, ?, ?, ?)`
  ).run(invoice.id, relanceType, options.sendSms ? "email+sms" : "email", message);

  db.prepare(
    `UPDATE invoices
     SET nombre_relances = nombre_relances + 1,
         last_relance_date = ?,
         relance_j3_sent_at = CASE WHEN ? = 'j3' THEN datetime('now') ELSE relance_j3_sent_at END,
         relance_j7_sent_at = CASE WHEN ? = 'j7' THEN datetime('now') ELSE relance_j7_sent_at END
     WHERE id = ?`
  ).run(today, relanceType, relanceType, invoice.id);

  return { skipped: false };
}

async function processOverdueReminders({ sendSms = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdueInvoices = db
    .prepare(
      `SELECT i.*, c.email, c.phone, c.company_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.due_date < ?
         AND (i.total - i.amount_received) > 0`
    )
    .all(today);

  for (const invoice of overdueInvoices) {
    const delay = daysBetween(invoice.due_date, today);
    if (delay >= 7 && !invoice.relance_j7_sent_at) {
      await sendInvoiceReminder(invoice, invoice, "j7", { sendSms });
    } else if (delay >= 3 && !invoice.relance_j3_sent_at) {
      await sendInvoiceReminder(invoice, invoice, "j3", { sendSms });
    }
  }
}

module.exports = {
  processOverdueReminders
};
