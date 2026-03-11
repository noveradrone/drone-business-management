import { useEffect, useState } from "react";
import { api } from "../api";
import DataTable from "../components/DataTable";

export default function InsurancesPage() {
  const [insurances, setInsurances] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    provider: "",
    policy_number: "",
    insured_entity_type: "company",
    insured_entity_id: "",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    premium_amount: "",
    coverage_details: "",
    notes: ""
  });

  async function load() {
    try {
      setInsurances(await api.insurances.list());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.insurances.create({
        ...form,
        insured_entity_id: form.insured_entity_id ? Number(form.insured_entity_id) : null,
        premium_amount: form.premium_amount ? Number(form.premium_amount) : null,
        coverage_details: form.coverage_details || null,
        notes: form.notes || null
      });
      setForm({
        provider: "",
        policy_number: "",
        insured_entity_type: "company",
        insured_entity_id: "",
        valid_from: new Date().toISOString().slice(0, 10),
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        premium_amount: "",
        coverage_details: "",
        notes: ""
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeInsurance(insurance) {
    if (!window.confirm(`Supprimer le contrat ${insurance.policy_number} ?`)) return;
    setError("");
    try {
      await api.insurances.remove(insurance.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Assurances</h2>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <input
          placeholder="Assureur"
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
          required
        />
        <input
          placeholder="Numéro de police"
          value={form.policy_number}
          onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
          required
        />
        <select
          value={form.insured_entity_type}
          onChange={(e) => setForm({ ...form, insured_entity_type: e.target.value })}
        >
          <option value="company">company</option>
          <option value="drone">drone</option>
        </select>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="ID entité (optionnel)"
          value={form.insured_entity_id}
          onChange={(e) => setForm({ ...form, insured_entity_id: e.target.value })}
        />
        <input
          type="date"
          value={form.valid_from}
          onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
          required
        />
        <input
          type="date"
          value={form.valid_until}
          onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
          required
        />
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Prime (optionnel)"
          value={form.premium_amount}
          onChange={(e) => setForm({ ...form, premium_amount: e.target.value })}
        />
        <input
          placeholder="Couvertures (optionnel)"
          value={form.coverage_details}
          onChange={(e) => setForm({ ...form, coverage_details: e.target.value })}
        />
        <input
          placeholder="Notes (optionnel)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button style={{ gridColumn: "1 / -1" }} disabled={submitting}>
          {submitting ? "Création..." : "Créer le contrat"}
        </button>
      </form>

      <DataTable>
          <thead>
            <tr>
              <th>Assureur</th>
              <th>Police</th>
              <th>Type</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Prime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {insurances.map((i) => (
              <tr key={i.id}>
                <td data-label="Assureur">{i.provider}</td>
                <td data-label="Police">{i.policy_number}</td>
                <td data-label="Type">{i.insured_entity_type}</td>
                <td data-label="Debut">{i.valid_from}</td>
                <td data-label="Fin">{i.valid_until}</td>
                <td data-label="Prime">{i.premium_amount ? `${Number(i.premium_amount).toFixed(2)} €` : "-"}</td>
                <td data-label="Actions" className="actions-cell">
                  <button type="button" className="danger" onClick={() => removeInsurance(i)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
    </div>
  );
}
