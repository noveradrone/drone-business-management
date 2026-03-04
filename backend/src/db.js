const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { dbPath, nodeEnv, allowDefaultAdmin } = require("./config");

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','pilot','accounting')) DEFAULT 'manager',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','maintenance','grounded','retired')) DEFAULT 'active',
  purchase_date TEXT,
  purchase_price REAL,
  total_flight_hours REAL NOT NULL DEFAULT 0,
  total_cycles INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drone_id INTEGER NOT NULL,
  maintenance_date TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  parts_replaced TEXT,
  flight_hours_at_maintenance REAL,
  cycles_at_maintenance INTEGER,
  cost REAL,
  next_due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  siret TEXT,
  vat_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drone_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  mission_date TEXT NOT NULL,
  location TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  flight_hours_logged REAL NOT NULL DEFAULT 0,
  cycles_logged INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (drone_id) REFERENCES drones(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS commercial_pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('prospect','quote_sent','followup_1','followup_2','accepted','lost')) DEFAULT 'prospect',
  source TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients_a_relancer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  mission_id INTEGER NOT NULL UNIQUE,
  phone TEXT,
  mission_date TEXT NOT NULL,
  avis_demande INTEGER NOT NULL DEFAULT 0,
  date_demande TEXT,
  compteur_relances INTEGER NOT NULL DEFAULT 0,
  last_relance_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  quote_number TEXT NOT NULL UNIQUE,
  quote_date TEXT NOT NULL,
  valid_until TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','sent','accepted','rejected','expired')) DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  mission_id INTEGER,
  quote_id INTEGER,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','sent','partial','paid','overdue','cancelled')) DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_received REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_relances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  relance_type TEXT NOT NULL CHECK(relance_type IN ('j3','j7')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  channel TEXT NOT NULL DEFAULT 'email',
  message TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_document TEXT NOT NULL,
  type_document TEXT NOT NULL DEFAULT 'autre',
  date_upload TEXT NOT NULL DEFAULT (datetime('now')),
  chemin_fichier TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reminder_type TEXT NOT NULL CHECK(reminder_type IN ('invoice_overdue','insurance_expiry','maintenance_due')),
  target_id INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','sent','dismissed')) DEFAULT 'pending',
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regulatory_preparations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL UNIQUE,
  category_type TEXT NOT NULL CHECK(category_type IN ('open','specific','certified')) DEFAULT 'open',
  open_subcategory TEXT CHECK(open_subcategory IN ('A1','A2','A3')),
  specific_type TEXT CHECK(specific_type IN ('STS-01','STS-02','PDRA','SORA','OTHER')),
  pdra_type TEXT CHECK(pdra_type IN ('PDRA-S01','PDRA-S02')),
  sora_required INTEGER NOT NULL DEFAULT 0,
  sts_declaration_required INTEGER NOT NULL DEFAULT 0,
  operational_authorization_required INTEGER NOT NULL DEFAULT 0,
  validation_manuel INTEGER NOT NULL DEFAULT 0,
  location_address TEXT,
  location_lat REAL,
  location_lng REAL,
  operation_date TEXT,
  start_time TEXT,
  end_time TEXT,
  altitude_max_m REAL,
  distance_to_people_m REAL,
  over_assemblies INTEGER NOT NULL DEFAULT 0,
  in_urban_area INTEGER NOT NULL DEFAULT 0,
  night_operation INTEGER NOT NULL DEFAULT 0,
  near_airport_or_ctr INTEGER NOT NULL DEFAULT 0,
  near_airport_details TEXT,
  restricted_zone INTEGER NOT NULL DEFAULT 0,
  restricted_zone_details TEXT,
  aircraft_class TEXT,
  mtom_kg REAL,
  remote_id INTEGER NOT NULL DEFAULT 0,
  observers_needed INTEGER NOT NULL DEFAULT 0,
  flyby_status TEXT NOT NULL CHECK(flyby_status IN ('todo','in_progress','done')) DEFAULT 'todo',
  alphatango_status TEXT NOT NULL CHECK(alphatango_status IN ('todo','in_progress','done')) DEFAULT 'todo',
  municipality_status TEXT NOT NULL CHECK(municipality_status IN ('todo','in_progress','done')) DEFAULT 'todo',
  landowner_status TEXT NOT NULL CHECK(landowner_status IN ('todo','in_progress','done')) DEFAULT 'todo',
  military_status TEXT NOT NULL CHECK(military_status IN ('todo','in_progress','done')) DEFAULT 'todo',
  doc_pack_zip_url TEXT,
  risk_assessment_pdf_url TEXT,
  ops_manual_extract_pdf_url TEXT,
  sts_declaration_pdf_url TEXT,
  sora_pack_pdf_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS regulatory_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preparation_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  obligatoire INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL CHECK(state IN ('todo','done')) DEFAULT 'todo',
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(preparation_id, item_key),
  FOREIGN KEY (preparation_id) REFERENCES regulatory_preparations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS regulatory_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preparation_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'proof',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (preparation_id) REFERENCES regulatory_preparations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS insurances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  policy_number TEXT NOT NULL UNIQUE,
  coverage_details TEXT,
  insured_entity_type TEXT NOT NULL CHECK(insured_entity_type IN ('company','drone')),
  insured_entity_id INTEGER,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  premium_amount REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Novera Drone',
  legal_form TEXT,
  capital_amount TEXT,
  address_line1 TEXT,
  zip_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'France',
  siret TEXT,
  vat_number TEXT,
  rcs_info TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  bank_name TEXT,
  bank_bic TEXT,
  bank_iban TEXT,
  logo_data_url TEXT,
  payment_terms TEXT DEFAULT 'Paiement a 30 jours',
  late_penalty_rate TEXT DEFAULT 'Taux BCE + 10 points',
  fixed_indemnity TEXT DEFAULT '40 EUR',
  vat_exemption_mention TEXT,
  quote_validity_days INTEGER DEFAULT 30,
  monthly_revenue_target REAL DEFAULT 4000,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_theme_preferences (
  user_id INTEGER PRIMARY KEY,
  theme_id TEXT NOT NULL DEFAULT 'ocean',
  primary_color TEXT NOT NULL DEFAULT '#0a84ff',
  secondary_color TEXT NOT NULL DEFAULT '#93c5fd',
  button_color TEXT NOT NULL DEFAULT '#0a84ff',
  background_color TEXT NOT NULL DEFAULT '#f3f6fb',
  sidebar_color TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.84)',
  mode TEXT NOT NULL CHECK(mode IN ('light','dark')) DEFAULT 'light',
  density TEXT NOT NULL CHECK(density IN ('comfortable','compact')) DEFAULT 'comfortable',
  radius_style TEXT NOT NULL CHECK(radius_style IN ('normal','rounded','pill')) DEFAULT 'rounded',
  shadows_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

db.exec(schema);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("clients", "siret", "TEXT");
ensureColumn("clients", "vat_number", "TEXT");
ensureColumn("clients", "source_channel", "TEXT");
ensureColumn("clients", "is_prospect", "INTEGER NOT NULL DEFAULT 0");

ensureColumn("missions", "preparation_hours", "REAL NOT NULL DEFAULT 0");
ensureColumn("missions", "flight_time_hours", "REAL NOT NULL DEFAULT 0");
ensureColumn("missions", "montage_hours", "REAL NOT NULL DEFAULT 0");
ensureColumn("missions", "mileage_km", "REAL NOT NULL DEFAULT 0");
ensureColumn("missions", "variable_costs", "REAL NOT NULL DEFAULT 0");
ensureColumn("missions", "department", "TEXT");
ensureColumn("missions", "selected_pack", "TEXT");
ensureColumn("missions", "mission_status", "TEXT NOT NULL DEFAULT 'planned'");
ensureColumn("missions", "avis_demande", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("missions", "date_avis_demande", "TEXT");
ensureColumn("missions", "avis_relances_count", "INTEGER NOT NULL DEFAULT 0");

ensureColumn("drones", "last_maintenance_date", "TEXT");
ensureColumn("drones", "incident_history", "TEXT");
ensureColumn("drones", "battery_cycle_threshold", "INTEGER NOT NULL DEFAULT 300");
ensureColumn("drones", "propeller_hours_threshold", "REAL NOT NULL DEFAULT 120");

ensureColumn("company_settings", "bank_name", "TEXT");
ensureColumn("company_settings", "bank_bic", "TEXT");
ensureColumn("company_settings", "bank_iban", "TEXT");
ensureColumn("company_settings", "monthly_revenue_target", "REAL DEFAULT 4000");
ensureColumn("company_settings", "show_vat", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "show_vat_exemption_mention", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "show_late_penalties", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "show_fixed_indemnity", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "show_bank_details", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "quote_show_signature_block", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("company_settings", "quote_show_validity_notice", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("user_theme_preferences", "theme_id", "TEXT NOT NULL DEFAULT 'ocean'");
ensureColumn("user_theme_preferences", "density", "TEXT NOT NULL DEFAULT 'comfortable'");

ensureColumn("invoices", "acompte_pourcentage", "REAL NOT NULL DEFAULT 0");
ensureColumn("invoices", "acompte_montant", "REAL NOT NULL DEFAULT 0");
ensureColumn("invoices", "solde_restant", "REAL NOT NULL DEFAULT 0");
ensureColumn("invoices", "date_paiement", "TEXT");
ensureColumn("invoices", "moyen_paiement", "TEXT");
ensureColumn("invoices", "note_interne", "TEXT");
ensureColumn("invoices", "nombre_relances", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("invoices", "last_relance_date", "TEXT");
ensureColumn("invoices", "relance_j3_sent_at", "TEXT");
ensureColumn("invoices", "relance_j7_sent_at", "TEXT");

ensureColumn("quotes", "currency", "TEXT NOT NULL DEFAULT 'EUR'");
ensureColumn("quotes", "discount_percent", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "discount_amount", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "subtotal_after_discount", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "acompte_percent", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "acompte_amount", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "estimated_balance", "REAL NOT NULL DEFAULT 0");
ensureColumn("quotes", "sent_at", "TEXT");

const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@drone.local");
if (!adminExists && (nodeEnv !== "production" || allowDefaultAdmin)) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run("Admin", "admin@drone.local", hash, "admin");
}

const settingsExist = db.prepare("SELECT id FROM company_settings WHERE id = 1").get();
if (!settingsExist) {
  db.prepare(
    `INSERT INTO company_settings (
      id, company_name, legal_form, capital_amount, address_line1, zip_code, city, country,
      siret, vat_number, rcs_info, phone, email, website, payment_terms, late_penalty_rate,
      fixed_indemnity, vat_exemption_mention, quote_validity_days, bank_name, bank_bic, bank_iban
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    1,
    "Novera Drone",
    "",
    "",
    "",
    "",
    "",
    "France",
    "",
    "",
    "",
    "",
    "",
    "",
    "Paiement a 30 jours",
    "Taux BCE + 10 points",
    "40 EUR",
    "",
    30,
    "",
    "",
    ""
  );
}

module.exports = db;
