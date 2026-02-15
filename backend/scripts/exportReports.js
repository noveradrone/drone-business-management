const fs = require("fs");
const path = require("path");
const { stringify } = require("csv-stringify/sync");
const db = require("../src/db");

const outputDir = path.resolve(process.cwd(), "exports");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const reports = {
  drones: "SELECT * FROM drones ORDER BY id DESC",
  missions: "SELECT * FROM missions ORDER BY id DESC",
  invoices: "SELECT * FROM invoices ORDER BY id DESC",
  payments: "SELECT * FROM payments ORDER BY id DESC",
  maintenance: "SELECT * FROM maintenance_records ORDER BY id DESC",
  insurances: "SELECT * FROM insurances ORDER BY id DESC"
};

Object.entries(reports).forEach(([name, sql]) => {
  const rows = db.prepare(sql).all();
  const csv = stringify(rows, { header: true });
  fs.writeFileSync(path.join(outputDir, `${name}.csv`), csv);
});

console.log(`CSV reports generated in ${outputDir}`);
