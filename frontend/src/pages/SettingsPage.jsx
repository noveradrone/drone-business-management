import { useEffect, useState } from "react";
import { api } from "../api";

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    company_name: "Novera Drone",
    legal_form: "",
    capital_amount: "",
    address_line1: "",
    zip_code: "",
    city: "",
    country: "France",
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
    payment_terms: "Paiement a 30 jours",
    late_penalty_rate: "Taux BCE + 10 points",
    fixed_indemnity: "40 EUR",
    vat_exemption_mention: "",
    quote_validity_days: 30,
    monthly_revenue_target: 4000
  });

  useEffect(() => {
    api.settings
      .company()
      .then((data) => setForm((prev) => ({ ...prev, ...data })))
      .catch((e) => setError(e.message));
  }, []);

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, logo_data_url: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setSaved(false);
    setError("");
    setSaving(true);
    try {
      const updated = await api.settings.updateCompany({
        ...form,
        quote_validity_days: Number(form.quote_validity_days || 30),
        monthly_revenue_target: Number(form.monthly_revenue_target || 0)
      });
      setForm((prev) => ({ ...prev, ...updated }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Parametres entreprise</h2>
        <span className="pill">Novera Drone</span>
      </div>

      {error && <p className="error">{error}</p>}
      {saved && <p style={{ color: "#106c2f", marginBottom: 10 }}>Parametres enregistres.</p>}

      <form className="form-grid" onSubmit={submit}>
        <input placeholder="Nom entreprise" value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
        <input placeholder="Forme juridique (ex: SASU)" value={form.legal_form || ""} onChange={(e) => setForm({ ...form, legal_form: e.target.value })} />
        <input placeholder="Capital" value={form.capital_amount || ""} onChange={(e) => setForm({ ...form, capital_amount: e.target.value })} />
        <input placeholder="Adresse" value={form.address_line1 || ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
        <input placeholder="Code postal" value={form.zip_code || ""} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
        <input placeholder="Ville" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input placeholder="Pays" value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <input placeholder="SIRET" value={form.siret || ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
        <input placeholder="TVA intracom" value={form.vat_number || ""} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
        <input placeholder="RCS" value={form.rcs_info || ""} onChange={(e) => setForm({ ...form, rcs_info: e.target.value })} />
        <input placeholder="Telephone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Site web" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <input placeholder="Nom de la banque" value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
        <input placeholder="SWIFT/BIC" value={form.bank_bic || ""} onChange={(e) => setForm({ ...form, bank_bic: e.target.value })} />
        <input placeholder="IBAN" value={form.bank_iban || ""} onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} />
        <input placeholder="Conditions de paiement" value={form.payment_terms || ""} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
        <input placeholder="Penalites retard" value={form.late_penalty_rate || ""} onChange={(e) => setForm({ ...form, late_penalty_rate: e.target.value })} />
        <input placeholder="Indemnite recouvrement" value={form.fixed_indemnity || ""} onChange={(e) => setForm({ ...form, fixed_indemnity: e.target.value })} />
        <input placeholder="Mention TVA non applicable" value={form.vat_exemption_mention || ""} onChange={(e) => setForm({ ...form, vat_exemption_mention: e.target.value })} />
        <input type="number" min="1" placeholder="Validite devis (jours)" value={form.quote_validity_days || 30} onChange={(e) => setForm({ ...form, quote_validity_days: e.target.value })} />
        <input type="number" min="0" step="0.01" placeholder="Objectif mensuel (EUR)" value={form.monthly_revenue_target || 0} onChange={(e) => setForm({ ...form, monthly_revenue_target: e.target.value })} />

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Logo (PNG/JPG)</label>
          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={onFileChange} />
          {form.logo_data_url ? (
            <div style={{ marginTop: 10 }}>
              <img src={form.logo_data_url} alt="logo" style={{ maxHeight: 100, objectFit: "contain" }} />
            </div>
          ) : null}
        </div>

        <button style={{ gridColumn: "1 / -1" }} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </form>
    </div>
  );
}
