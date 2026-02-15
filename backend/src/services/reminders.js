const db = require("../db");

function refreshAutomaticReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  db.prepare("DELETE FROM reminders WHERE status = 'pending'").run();

  const overdueInvoices = db
    .prepare(
      `SELECT id, due_date, invoice_number FROM invoices
       WHERE status IN ('sent','partial','overdue') AND due_date < ?`
    )
    .all(today);

  const expiringInsurances = db
    .prepare(
      `SELECT id, valid_until, policy_number FROM insurances
       WHERE valid_until BETWEEN ? AND ?`
    )
    .all(today, inSevenDays);

  const maintenanceDue = db
    .prepare(
      `SELECT id, drone_id, next_due_date FROM maintenance_records
       WHERE next_due_date BETWEEN ? AND ?`
    )
    .all(today, inSevenDays);

  const insert = db.prepare(
    `INSERT INTO reminders (reminder_type, target_id, due_date, message)
     VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    overdueInvoices.forEach((inv) => {
      insert.run(
        "invoice_overdue",
        inv.id,
        inv.due_date,
        `Invoice ${inv.invoice_number} is overdue since ${inv.due_date}`
      );
    });

    expiringInsurances.forEach((ins) => {
      insert.run(
        "insurance_expiry",
        ins.id,
        ins.valid_until,
        `Insurance policy ${ins.policy_number} expires on ${ins.valid_until}`
      );
    });

    maintenanceDue.forEach((m) => {
      insert.run(
        "maintenance_due",
        m.drone_id,
        m.next_due_date,
        `Drone ${m.drone_id} maintenance due on ${m.next_due_date}`
      );
    });
  });

  transaction();
}

module.exports = { refreshAutomaticReminders };
