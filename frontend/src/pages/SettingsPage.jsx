import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { applyTheme, DEFAULT_THEME } from "../theme";

const tabs = [
  { key: "entreprise", label: "Entreprise", desc: "Identité et coordonnées publiques." },
  { key: "facturation", label: "Facturation", desc: "Banque, mentions et conditions." },
  { key: "devis", label: "Devis", desc: "Validité et options commerciales." },
  { key: "apparence", label: "Apparence", desc: "Personnalisation visuelle de l'interface." },
  { key: "notifications", label: "Notifications", desc: "Préférences de rappel." },
  { key: "securite", label: "Securite", desc: "Options de protection et accès." }
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("entreprise");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);

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
    monthly_revenue_target: 4000
  });
  const [appearance, setAppearance] = useState(DEFAULT_THEME);

  useEffect(() => {
    Promise.all([api.settings.company(), api.settings.theme()])
      .then(([company, theme]) => {
        setForm((prev) => ({ ...prev, ...company }));
        setAppearance((prev) => ({ ...prev, ...(theme || {}) }));
        applyTheme(theme || DEFAULT_THEME);
      })
      .catch((e) => setError(e.message));
  }, []);

  const activeMeta = useMemo(() => tabs.find((t) => t.key === activeTab), [activeTab]);

  async function saveCompanySection(section) {
    setSavedSection("");
    setError("");
    setSaving(true);
    try {
      const updated = await api.settings.updateCompany({
        ...form,
        quote_validity_days: Number(form.quote_validity_days || 30),
        monthly_revenue_target: Number(form.monthly_revenue_target || 0)
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
    applyTheme(next);
  }

  async function saveTheme() {
    setError("");
    setThemeSaved(false);
    setThemeSaving(true);
    try {
      const updated = await api.settings.updateTheme(appearance);
      setAppearance((prev) => ({ ...prev, ...(updated || {}) }));
      applyTheme(updated || appearance);
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
      setAppearance((prev) => ({ ...prev, ...(reset || DEFAULT_THEME) }));
      applyTheme(reset || DEFAULT_THEME);
      setThemeSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="page-head">
        <h2>Parametres</h2>
        <span className="pill">{activeMeta?.label}</span>
      </div>
      <p className="page-summary">{activeMeta?.desc}</p>

      {error && <p className="error">{error}</p>}
      {savedSection && <p style={{ color: "#106c2f", marginBottom: 10 }}>Section {savedSection} enregistree.</p>}
      {themeSaved && <p style={{ color: "#106c2f", marginBottom: 10 }}>Apparence enregistree.</p>}

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
            <button type="button" onClick={() => saveCompanySection("Devis")} disabled={saving} style={{ gridColumn: "1 / -1" }}>
              {saving ? "Enregistrement..." : "Enregistrer Devis"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "apparence" && (
        <div className="card">
          <h3>Apparence</h3>
          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <label>
              Couleur principale
              <input type="color" value={appearance.primary_color} onChange={(e) => onThemeChange("primary_color", e.target.value)} />
            </label>
            <label>
              Couleur secondaire
              <input type="color" value={appearance.secondary_color} onChange={(e) => onThemeChange("secondary_color", e.target.value)} />
            </label>
            <label>
              Couleur boutons
              <input type="color" value={appearance.button_color} onChange={(e) => onThemeChange("button_color", e.target.value)} />
            </label>
            <label>
              Couleur fond
              <input type="color" value={appearance.background_color} onChange={(e) => onThemeChange("background_color", e.target.value)} />
            </label>
            <label>
              Couleur sidebar
              <input type="text" value={appearance.sidebar_color} onChange={(e) => onThemeChange("sidebar_color", e.target.value)} placeholder="#ffffff ou rgba(...)" />
            </label>
            <label>
              Mode
              <select value={appearance.mode} onChange={(e) => onThemeChange("mode", e.target.value)}>
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </select>
            </label>
            <label>
              Arrondis
              <select value={appearance.radius_style} onChange={(e) => onThemeChange("radius_style", e.target.value)}>
                <option value="normal">Normales</option>
                <option value="rounded">Arrondies</option>
                <option value="pill">Tres arrondies</option>
              </select>
            </label>
            <label>
              Ombres
              <select value={String(appearance.shadows_enabled ? 1 : 0)} onChange={(e) => onThemeChange("shadows_enabled", Number(e.target.value))}>
                <option value="1">Activees</option>
                <option value="0">Desactivees</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", flexWrap: "wrap" }}>
              <button type="button" onClick={saveTheme} disabled={themeSaving}>
                {themeSaving ? "Enregistrement..." : "Enregistrer Apparence"}
              </button>
              <button type="button" className="secondary" onClick={resetTheme} disabled={themeSaving}>
                Reinitialiser theme
              </button>
            </div>
          </form>
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
