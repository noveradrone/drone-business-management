const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/company", authRequired, (req, res) => {
  const row = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
  res.json(row || {});
});

router.put("/company", authRequired, (req, res) => {
  const payload = req.body || {};
  const current = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || { id: 1 };

  const merged = {
    ...current,
    ...payload,
    id: 1,
    quote_validity_days:
      payload.quote_validity_days === undefined
        ? current.quote_validity_days
        : Number(payload.quote_validity_days || 30),
    monthly_revenue_target:
      payload.monthly_revenue_target === undefined
        ? Number(current.monthly_revenue_target || 4000)
        : Number(payload.monthly_revenue_target || 0),
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
  };

  db.prepare(
    `INSERT INTO company_settings (
      id, company_name, legal_form, capital_amount, address_line1, zip_code, city, country,
      siret, vat_number, rcs_info, phone, email, website, bank_name, bank_bic, bank_iban, logo_data_url, payment_terms,
      late_penalty_rate, fixed_indemnity, vat_exemption_mention, quote_validity_days, monthly_revenue_target, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      company_name=excluded.company_name,
      legal_form=excluded.legal_form,
      capital_amount=excluded.capital_amount,
      address_line1=excluded.address_line1,
      zip_code=excluded.zip_code,
      city=excluded.city,
      country=excluded.country,
      siret=excluded.siret,
      vat_number=excluded.vat_number,
      rcs_info=excluded.rcs_info,
      phone=excluded.phone,
      email=excluded.email,
      website=excluded.website,
      bank_name=excluded.bank_name,
      bank_bic=excluded.bank_bic,
      bank_iban=excluded.bank_iban,
      logo_data_url=excluded.logo_data_url,
      payment_terms=excluded.payment_terms,
      late_penalty_rate=excluded.late_penalty_rate,
      fixed_indemnity=excluded.fixed_indemnity,
      vat_exemption_mention=excluded.vat_exemption_mention,
      quote_validity_days=excluded.quote_validity_days,
      monthly_revenue_target=excluded.monthly_revenue_target,
      updated_at=excluded.updated_at`
  ).run(
    merged.id,
    merged.company_name || "Novera Drone",
    merged.legal_form || "",
    merged.capital_amount || "",
    merged.address_line1 || "",
    merged.zip_code || "",
    merged.city || "",
    merged.country || "France",
    merged.siret || "",
    merged.vat_number || "",
    merged.rcs_info || "",
    merged.phone || "",
    merged.email || "",
    merged.website || "",
    merged.bank_name || "",
    merged.bank_bic || "",
    merged.bank_iban || "",
    merged.logo_data_url || "",
    merged.payment_terms || "Paiement a 30 jours",
    merged.late_penalty_rate || "Taux BCE + 10 points",
    merged.fixed_indemnity || "40 EUR",
    merged.vat_exemption_mention || "",
    merged.quote_validity_days || 30,
    Number(merged.monthly_revenue_target || 0),
    merged.updated_at
  );

  const updated = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
  res.json(updated);
});

module.exports = router;
