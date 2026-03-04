import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  applyTheme,
  DEFAULT_THEME,
  THEME_PRESETS,
  getThemeTokens,
  persistAppearanceSettings,
  getAppearanceSettingsFromLocal,
  fromAppearanceSettings
} from "../theme";

const tabs = [
  { key: "entreprise", label: "Entreprise", desc: "Identité et coordonnées publiques." },
  { key: "facturation", label: "Facturation", desc: "Banque, mentions et conditions." },
  { key: "devis", label: "Devis", desc: "Validité et options commerciales." },
  { key: "apparence", label: "Apparence", desc: "Personnalisation visuelle de l'interface." },
  { key: "notifications", label: "Notifications", desc: "Préférences de rappel." },
  { key: "securite", label: "Securite", desc: "Options de protection et accès." }
];

const DENSITY_KEY = "drone_business_density";
const SHADOW_LEVEL_KEY = "drone_business_shadow_level";

const SHADOWS = {
  off: "none",
  subtle: "0 8px 20px rgba(15, 23, 42, 0.10)",
  strong: "0 18px 42px rgba(15, 23, 42, 0.18)"
};

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented-control" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? "seg-item active" : "seg-item"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("entreprise");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem(DENSITY_KEY) === "compact");
  const [shadowLevel, setShadowLevel] = useState(() => localStorage.getItem(SHADOW_LEVEL_KEY) || "subtle");

  const [form, setForm] = useState({
    company_name: "",
    legal_form: "",
    capital_amount: "",
    address_line1: "",
    zip_code: "",
    city: "",
    country: "",
    siret: "",
    vat_number: "",
    rcs_info: "",
    phone: "",
    email: "",
    website: "",
    bank_name: "",
    bank_bic: "",
    bank_iban: "",
    logo_data_url: "",
    payment_terms: "",
    late_penalty_rate: "",
    fixed_indemnity: "",
    vat_exemption_mention: "",
    quote_validity_days: 30,
    monthly_revenue_target: 4000,
    show_vat: 1,
    show_vat_exemption_mention: 1,
    show_late_penalties: 1,
    show_fixed_indemnity: 1,
    show_bank_details: 1,
    quote_show_signature_block: 1,
    quote_show_validity_notice: 1
  });
  const [appearance, setAppearance] = useState(DEFAULT_THEME);

  function applyAppearanceLive(theme, shadow, compact) {
    applyTheme({ ...theme, density: compact ? "compact" : "comfortable" });
    document.documentElement.style.setProperty("--shadow", theme.shadows_enabled ? SHADOWS[shadow] || SHADOWS.subtle : "none");
    document.documentElement.setAttribute("data-density", compact ? "compact" : "comfortable");
    localStorage.setItem(DENSITY_KEY, compact ? "compact" : "comfortable");
    localStorage.setItem(SHADOW_LEVEL_KEY, shadow);
  }

  useEffect(() => {
    Promise.all([api.settings.company(), api.settings.theme()])
      .then(([company, theme]) => {
        const mergedTheme = { ...DEFAULT_THEME, ...(theme || {}) };
        const compactFromTheme = (theme?.density || mergedTheme.density) === "compact";
        setForm((prev) => ({ ...prev, ...company }));
        setAppearance(mergedTheme);
        setCompactMode(compactFromTheme);

        if (!mergedTheme.shadows_enabled) {
          setShadowLevel("off");
        }

        applyAppearanceLive(mergedTheme, !mergedTheme.shadows_enabled ? "off" : shadowLevel, compactFromTheme);
        persistAppearanceSettings(mergedTheme, mergedTheme?.user_id || null);
      })
      .catch((e) => {
        const localSettings = getAppearanceSettingsFromLocal();
        const localTheme = fromAppearanceSettings(localSettings);
        if (localTheme) {
          setAppearance(localTheme);
          setCompactMode(localTheme.density === "compact");
          setShadowLevel(localTheme.shadows_enabled ? "subtle" : "off");
          applyAppearanceLive(localTheme, localTheme.shadows_enabled ? "subtle" : "off", localTheme.density === "compact");
        } else {
          setError(e.message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyAppearanceLive(appearance, shadowLevel, compactMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, shadowLevel, compactMode]);

  const activeMeta = useMemo(() => tabs.find((t) => t.key === activeTab), [activeTab]);

  async function saveCompanySection(section) {
    setSavedSection("");
    setError("");
    setSaving(true);
    try {
      const updated = await api.settings.updateCompany({
        ...form,
        quote_validity_days: Number(form.quote_validity_days || 30),
        monthly_revenue_target: Number(form.monthly_revenue_target || 0),
        show_vat: Number(form.show_vat || 0),
        show_vat_exemption_mention: Number(form.show_vat_exemption_mention || 0),
        show_late_penalties: Number(form.show_late_penalties || 0),
        show_fixed_indemnity: Number(form.show_fixed_indemnity || 0),
        show_bank_details: Number(form.show_bank_details || 0),
        quote_show_signature_block: Number(form.quote_show_signature_block || 0),
        quote_show_validity_notice: Number(form.quote_show_validity_notice || 0)
      });
      setForm((prev) => ({ ...prev, ...updated }));
      setSavedSection(section);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, logo_data_url: reader.result }));
    reader.readAsDataURL(file);
  }

  function onThemeChange(key, value) {
    const next = { ...appearance, [key]: value };
    setAppearance(next);
    setThemeSaved(false);
  }

  function setMode(mode) {
    onThemeChange("mode", mode);
  }

  function setThemeId(themeId) {
    onThemeChange("theme_id", themeId);
  }

  function setRadius(radiusValue) {
    const mapped = radiusValue === "compact" ? "normal" : radiusValue === "pill" ? "pill" : "rounded";
    onThemeChange("radius_style", mapped);
  }

  function setShadow(level) {
    setShadowLevel(level);
    onThemeChange("shadows_enabled", level === "off" ? 0 : 1);
  }

  async function saveTheme() {
    setError("");
    setThemeSaved(false);
    setThemeSaving(true);
    try {
      const payload = {
        ...appearance,
        theme_id: appearance.theme_id || DEFAULT_THEME.theme_id,
        mode: appearance.mode || "light",
        density: compactMode ? "compact" : "comfortable",
        shadows_enabled: shadowLevel === "off" ? 0 : 1
      };
      const updated = await api.settings.updateTheme(payload);
      const merged = { ...appearance, ...(updated || {}) };
      setAppearance(merged);
      persistAppearanceSettings(merged, merged?.user_id || null);
      localStorage.setItem("appearance_settings", JSON.stringify(payload));
      setThemeSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  async function resetTheme() {
    setError("");
    setThemeSaved(false);
    setThemeSaving(true);
    try {
      const reset = await api.settings.resetTheme();
      const merged = { ...DEFAULT_THEME, ...(reset || {}) };
      setAppearance(merged);
      setShadowLevel("subtle");
      setCompactMode(false);
      persistAppearanceSettings(merged, merged?.user_id || null);
      localStorage.setItem("appearance_settings", JSON.stringify({
        theme_mode: "clair",
        compact_mode: false,
        border_radius_style: "standard",
        shadow_style: "subtiles"
      }));
      setThemeSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  const previewTokens = getThemeTokens(appearance.theme_id, appearance.mode);
  const previewStyle = {
    "--p-primary": previewTokens.primary,
    "--p-secondary": previewTokens.secondary,
    "--p-button": previewTokens.primary,
    "--p-bg": previewTokens.bg,
    "--p-sidebar": previewTokens.sidebar,
    "--p-surface": previewTokens.surfaceStrong,
    "--p-text": previewTokens.text,
    "--p-muted": previewTokens.textMuted,
    "--p-border": previewTokens.border,
    "--p-radius": appearance.radius_style === "normal" ? "10px" : appearance.radius_style === "pill" ? "22px" : "14px",
    "--p-shadow": appearance.shadows_enabled ? SHADOWS[shadowLevel] : "none"
  };

  const radiusMode = appearance.radius_style === "normal" ? "compact" : appearance.radius_style === "pill" ? "pill" : "standard";

  return (
    <div className="settings-page">
      <div className="page-head">
        <h2>Parametres</h2>
        <span className="pill">{activeMeta?.label}</span>
      </div>
      <p className="page-summary">{activeMeta?.desc}</p>

      {error && <p className="error">{error}</p>}
      {savedSection && <p style={{ color: "var(--success)", marginBottom: 10 }}>Section {savedSection} enregistree.</p>}

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`secondary ${activeTab === tab.key ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "entreprise" && (
        <div className="card">
          <h3>Identite entreprise</h3>
          <p className="documents-intro">Les champs vides ne seront plus affiches dans les PDF.</p>
          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="Nom entreprise (optionnel)" value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <input placeholder="Forme juridique" value={form.legal_form || ""} onChange={(e) => setForm({ ...form, legal_form: e.target.value })} />
            <input placeholder="Capital" value={form.capital_amount || ""} onChange={(e) => setForm({ ...form, capital_amount: e.target.value })} />
            <input placeholder="Adresse" value={form.address_line1 || ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            <input placeholder="Code postal" value={form.zip_code || ""} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
            <input placeholder="Ville" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input placeholder="Pays" value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <input placeholder="Telephone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Site web" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Logo (PNG/JPG, optionnel)</label>
              <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={onFileChange} />
              {form.logo_data_url ? (
                <div style={{ marginTop: 10 }}>
                  <img src={form.logo_data_url} alt="logo" style={{ maxHeight: 100, objectFit: "contain" }} />
                </div>
              ) : null}
            </div>

            <button type="button" onClick={() => saveCompanySection("Entreprise")} disabled={saving} style={{ gridColumn: "1 / -1" }}>
              {saving ? "Enregistrement..." : "Enregistrer Entreprise"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "facturation" && (
        <div className="card">
          <h3>Facturation</h3>
          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="SIRET" value={form.siret || ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
            <input placeholder="TVA intracom" value={form.vat_number || ""} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
            <input placeholder="RCS" value={form.rcs_info || ""} onChange={(e) => setForm({ ...form, rcs_info: e.target.value })} />
            <input placeholder="Banque" value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            <input placeholder="SWIFT/BIC" value={form.bank_bic || ""} onChange={(e) => setForm({ ...form, bank_bic: e.target.value })} />
            <input placeholder="IBAN" value={form.bank_iban || ""} onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} />
            <input placeholder="Conditions de paiement" value={form.payment_terms || ""} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
            <input placeholder="Penalites retard" value={form.late_penalty_rate || ""} onChange={(e) => setForm({ ...form, late_penalty_rate: e.target.value })} />
            <input placeholder="Indemnite recouvrement" value={form.fixed_indemnity || ""} onChange={(e) => setForm({ ...form, fixed_indemnity: e.target.value })} />
            <input placeholder="Mention TVA non applicable" value={form.vat_exemption_mention || ""} onChange={(e) => setForm({ ...form, vat_exemption_mention: e.target.value })} />
            <label>
              Afficher TVA
              <select value={String(Number(form.show_vat || 0))} onChange={(e) => setForm({ ...form, show_vat: Number(e.target.value) })}>
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <label>
              Afficher mention TVA non applicable
              <select
                value={String(Number(form.show_vat_exemption_mention || 0))}
                onChange={(e) => setForm({ ...form, show_vat_exemption_mention: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <label>
              Afficher penalites de retard
              <select
                value={String(Number(form.show_late_penalties || 0))}
                onChange={(e) => setForm({ ...form, show_late_penalties: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <label>
              Afficher indemnite forfaitaire 40EUR
              <select
                value={String(Number(form.show_fixed_indemnity || 0))}
                onChange={(e) => setForm({ ...form, show_fixed_indemnity: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <label>
              Afficher coordonnees bancaires
              <select
                value={String(Number(form.show_bank_details || 0))}
                onChange={(e) => setForm({ ...form, show_bank_details: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <button type="button" onClick={() => saveCompanySection("Facturation")} disabled={saving} style={{ gridColumn: "1 / -1" }}>
              {saving ? "Enregistrement..." : "Enregistrer Facturation"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "devis" && (
        <div className="card">
          <h3>Parametres Devis</h3>
          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <input type="number" min="1" placeholder="Validite devis (jours)" value={form.quote_validity_days || 30} onChange={(e) => setForm({ ...form, quote_validity_days: e.target.value })} />
            <input type="number" min="0" step="0.01" placeholder="Objectif mensuel (EUR)" value={form.monthly_revenue_target || 0} onChange={(e) => setForm({ ...form, monthly_revenue_target: e.target.value })} />
            <label>
              Afficher mention validite devis
              <select
                value={String(Number(form.quote_show_validity_notice || 0))}
                onChange={(e) => setForm({ ...form, quote_show_validity_notice: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <label>
              Afficher bloc Bon pour accord
              <select
                value={String(Number(form.quote_show_signature_block || 0))}
                onChange={(e) => setForm({ ...form, quote_show_signature_block: Number(e.target.value) })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </label>
            <button type="button" onClick={() => saveCompanySection("Devis")} disabled={saving} style={{ gridColumn: "1 / -1" }}>
              {saving ? "Enregistrement..." : "Enregistrer Devis"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "apparence" && (
        <div className="appearance-modern">
          <div className="appearance-headline">
            <h3>Apparence</h3>
            <p>Selectionne un theme professionnel, puis ajuste mode, densite et style.</p>
          </div>

          <div className="appearance-preview" style={previewStyle}>
            <div className="preview-topbar">
              <span className="preview-dot" />
              <span>Mini aperçu dashboard</span>
              <button type="button">Action</button>
            </div>
            <div className="preview-body">
              <aside>
                <div className="preview-nav active" />
                <div className="preview-nav" />
                <div className="preview-nav" />
              </aside>
              <section>
                <div className="preview-card-row">
                  <div className="preview-card" />
                  <div className="preview-card" />
                  <div className="preview-card" />
                </div>
                <div className="preview-chart" />
              </section>
            </div>
          </div>

          <div className="card appearance-card">
            <h4>Choisir un theme</h4>
            <div className="theme-grid">
              {Object.entries(THEME_PRESETS).map(([themeId, def]) => {
                const light = def.light;
                const dark = def.dark;
                const isActive = (appearance.theme_id || DEFAULT_THEME.theme_id) === themeId;
                return (
                  <button
                    key={themeId}
                    type="button"
                    className={`theme-tile ${isActive ? "active" : ""}`}
                    onClick={() => setThemeId(themeId)}
                  >
                    <div className="theme-tile-head">
                      <strong>{def.label}</strong>
                      {isActive ? <span className="pill">Actif</span> : null}
                    </div>
                    <div className="theme-swatches">
                      <span style={{ background: light.primary }} />
                      <span style={{ background: light.secondary }} />
                      <span style={{ background: light.bg }} />
                      <span style={{ background: dark.bg }} />
                      <span style={{ background: dark.primary }} />
                    </div>
                    <div className="theme-mini-btn" style={{ background: light.primary, color: light.buttonText }}>
                      Bouton
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="appearance-grid">
            <div className="card appearance-card">
              <h4>Mode</h4>
              <SegmentedControl
                value={appearance.mode}
                onChange={setMode}
                options={[
                  { value: "light", label: "Clair" },
                  { value: "dark", label: "Sombre" }
                ]}
              />
              <p className="appearance-hint">Densite</p>
              <SegmentedControl
                value={compactMode ? "compact" : "comfortable"}
                onChange={(v) => setCompactMode(v === "compact")}
                options={[
                  { value: "comfortable", label: "Standard" },
                  { value: "compact", label: "Compact" }
                ]}
              />
            </div>

            <div className="card appearance-card">
              <h4>Style</h4>
              <p className="appearance-hint">Arrondis</p>
              <SegmentedControl
                value={radiusMode}
                onChange={setRadius}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "standard", label: "Standard" },
                  { value: "pill", label: "Tres arrondi" }
                ]}
              />
              <p className="appearance-hint">Ombres</p>
              <SegmentedControl
                value={shadowLevel}
                onChange={setShadow}
                options={[
                  { value: "off", label: "Desactivees" },
                  { value: "subtle", label: "Subtiles" },
                  { value: "strong", label: "Prononcees" }
                ]}
              />
            </div>
          </div>

          <div className="appearance-actions">
            <button type="button" onClick={saveTheme} disabled={themeSaving}>
              {themeSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className="secondary" onClick={resetTheme} disabled={themeSaving}>
              Reinitialiser theme
            </button>
            {themeSaved ? <span className="pill">Theme enregistre</span> : null}
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="card">
          <h3>Notifications</h3>
          <p className="documents-intro">Section reservee aux preferences de relances automatiques (email/SMS).</p>
          <button type="button" className="secondary" onClick={() => saveCompanySection("Notifications")} disabled={saving}>
            Enregistrer Notifications
          </button>
        </div>
      )}

      {activeTab === "securite" && (
        <div className="card">
          <h3>Securite</h3>
          <p className="documents-intro">Parametres de securite applicative et politiques de connexion.</p>
          <button type="button" className="secondary" onClick={() => saveCompanySection("Securite")} disabled={saving}>
            Enregistrer Securite
          </button>
        </div>
      )}
    </div>
  );
}
