const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_THEME = {
  primary_color: "#0a84ff",
  secondary_color: "#93c5fd",
  button_color: "#0a84ff",
  background_color: "#f3f6fb",
  sidebar_color: "rgba(255,255,255,0.84)",
  mode: "light",
  radius_style: "rounded",
  shadows_enabled: 1
};

function sanitizeTheme(payload = {}) {
  const hexColor = /^#[0-9a-fA-F]{6}$/;
  const validRgba = /^rgba?\(.+\)$/;
  const theme = {
    primary_color: hexColor.test(String(payload.primary_color || "")) ? payload.primary_color : DEFAULT_THEME.primary_color,
    secondary_color: hexColor.test(String(payload.secondary_color || "")) ? payload.secondary_color : DEFAULT_THEME.secondary_color,
    button_color: hexColor.test(String(payload.button_color || "")) ? payload.button_color : DEFAULT_THEME.button_color,
    background_color: hexColor.test(String(payload.background_color || "")) ? payload.background_color : DEFAULT_THEME.background_color,
    sidebar_color:
      hexColor.test(String(payload.sidebar_color || "")) || validRgba.test(String(payload.sidebar_color || ""))
        ? payload.sidebar_color
        : DEFAULT_THEME.sidebar_color,
    mode: payload.mode === "dark" ? "dark" : "light",
    radius_style: ["normal", "rounded", "pill"].includes(payload.radius_style) ? payload.radius_style : "rounded",
    shadows_enabled: payload.shadows_enabled ? 1 : 0
  };
  return theme;
}

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
    show_vat:
      payload.show_vat === undefined ? Number(current.show_vat ?? 1) : (payload.show_vat ? 1 : 0),
    show_vat_exemption_mention:
      payload.show_vat_exemption_mention === undefined
        ? Number(current.show_vat_exemption_mention ?? 1)
        : (payload.show_vat_exemption_mention ? 1 : 0),
    show_late_penalties:
      payload.show_late_penalties === undefined
        ? Number(current.show_late_penalties ?? 1)
        : (payload.show_late_penalties ? 1 : 0),
    show_fixed_indemnity:
      payload.show_fixed_indemnity === undefined
        ? Number(current.show_fixed_indemnity ?? 1)
        : (payload.show_fixed_indemnity ? 1 : 0),
    show_bank_details:
      payload.show_bank_details === undefined
        ? Number(current.show_bank_details ?? 1)
        : (payload.show_bank_details ? 1 : 0),
    quote_show_signature_block:
      payload.quote_show_signature_block === undefined
        ? Number(current.quote_show_signature_block ?? 1)
        : (payload.quote_show_signature_block ? 1 : 0),
    quote_show_validity_notice:
      payload.quote_show_validity_notice === undefined
        ? Number(current.quote_show_validity_notice ?? 1)
        : (payload.quote_show_validity_notice ? 1 : 0),
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
  };

  db.prepare(
    `INSERT INTO company_settings (
      id, company_name, legal_form, capital_amount, address_line1, zip_code, city, country,
      siret, vat_number, rcs_info, phone, email, website, bank_name, bank_bic, bank_iban, logo_data_url, payment_terms,
      late_penalty_rate, fixed_indemnity, vat_exemption_mention, quote_validity_days, monthly_revenue_target,
      show_vat, show_vat_exemption_mention, show_late_penalties, show_fixed_indemnity, show_bank_details,
      quote_show_signature_block, quote_show_validity_notice, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      show_vat=excluded.show_vat,
      show_vat_exemption_mention=excluded.show_vat_exemption_mention,
      show_late_penalties=excluded.show_late_penalties,
      show_fixed_indemnity=excluded.show_fixed_indemnity,
      show_bank_details=excluded.show_bank_details,
      quote_show_signature_block=excluded.quote_show_signature_block,
      quote_show_validity_notice=excluded.quote_show_validity_notice,
      updated_at=excluded.updated_at`
  ).run(
    merged.id,
    merged.company_name ?? "",
    merged.legal_form ?? "",
    merged.capital_amount ?? "",
    merged.address_line1 ?? "",
    merged.zip_code ?? "",
    merged.city ?? "",
    merged.country ?? "",
    merged.siret ?? "",
    merged.vat_number ?? "",
    merged.rcs_info ?? "",
    merged.phone ?? "",
    merged.email ?? "",
    merged.website ?? "",
    merged.bank_name ?? "",
    merged.bank_bic ?? "",
    merged.bank_iban ?? "",
    merged.logo_data_url ?? "",
    merged.payment_terms ?? "",
    merged.late_penalty_rate ?? "",
    merged.fixed_indemnity ?? "",
    merged.vat_exemption_mention ?? "",
    merged.quote_validity_days ?? 30,
    Number(merged.monthly_revenue_target ?? 0),
    Number(merged.show_vat ?? 1),
    Number(merged.show_vat_exemption_mention ?? 1),
    Number(merged.show_late_penalties ?? 1),
    Number(merged.show_fixed_indemnity ?? 1),
    Number(merged.show_bank_details ?? 1),
    Number(merged.quote_show_signature_block ?? 1),
    Number(merged.quote_show_validity_notice ?? 1),
    merged.updated_at
  );

  const updated = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
  res.json(updated);
});

router.get("/theme", authRequired, (req, res) => {
  const existing = db
    .prepare("SELECT * FROM user_theme_preferences WHERE user_id = ?")
    .get(req.user.id);
  if (!existing) {
    return res.json({
      user_id: req.user.id,
      ...DEFAULT_THEME
    });
  }
  return res.json(existing);
});

router.put("/theme", authRequired, (req, res) => {
  const theme = sanitizeTheme(req.body || {});
  db.prepare(
    `INSERT INTO user_theme_preferences (
      user_id, primary_color, secondary_color, button_color, background_color, sidebar_color,
      mode, radius_style, shadows_enabled, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      primary_color=excluded.primary_color,
      secondary_color=excluded.secondary_color,
      button_color=excluded.button_color,
      background_color=excluded.background_color,
      sidebar_color=excluded.sidebar_color,
      mode=excluded.mode,
      radius_style=excluded.radius_style,
      shadows_enabled=excluded.shadows_enabled,
      updated_at=datetime('now')`
  ).run(
    req.user.id,
    theme.primary_color,
    theme.secondary_color,
    theme.button_color,
    theme.background_color,
    theme.sidebar_color,
    theme.mode,
    theme.radius_style,
    theme.shadows_enabled
  );

  const updated = db
    .prepare("SELECT * FROM user_theme_preferences WHERE user_id = ?")
    .get(req.user.id);
  return res.json(updated);
});

router.delete("/theme", authRequired, (req, res) => {
  db.prepare("DELETE FROM user_theme_preferences WHERE user_id = ?").run(req.user.id);
  return res.json({
    user_id: req.user.id,
    ...DEFAULT_THEME
  });
});

module.exports = router;
