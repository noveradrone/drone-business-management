import { useEffect, useState } from "react";
import { api } from "../api";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    billing_address: "",
    siret: "",
    vat_number: "",
    source_channel: "",
    is_prospect: 1
  });
  const [error, setError] = useState("");

  async function load() {
    try {
      setClients(await api.clients.list());
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
    try {
      await api.clients.create(form);
      setForm({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        billing_address: "",
        siret: "",
        vat_number: "",
        source_channel: "",
        is_prospect: 1
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeClient(client) {
    if (!window.confirm(`Supprimer le client ${client.company_name} ?`)) return;
    setError("");
    try {
      await api.clients.remove(client.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Clients</h2>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <input placeholder="Entreprise" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
        <input placeholder="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="tel" inputMode="tel" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Adresse de facturation" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
        <input placeholder="SIRET client" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
        <input placeholder="TVA client" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
        <input placeholder="Source lead (Instagram, Google...)" value={form.source_channel} onChange={(e) => setForm({ ...form, source_channel: e.target.value })} />
        <select value={String(form.is_prospect)} onChange={(e) => setForm({ ...form, is_prospect: Number(e.target.value) })}>
          <option value="1">Prospect</option>
          <option value="0">Client actif</option>
        </select>
        <button style={{ gridColumn: "1 / -1" }}>Ajouter</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>SIRET</th>
              <th>TVA</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td data-label="Entreprise">{c.company_name}</td>
                <td data-label="Contact">{c.contact_name || "-"}</td>
                <td data-label="Email">{c.email || "-"}</td>
                <td data-label="Telephone">{c.phone || "-"}</td>
                <td data-label="SIRET">{c.siret || "-"}</td>
                <td data-label="TVA">{c.vat_number || "-"}</td>
                <td data-label="Source">{c.source_channel || "-"}</td>
                <td data-label="Actions" className="actions-cell">
                  {c.phone ? (
                    <a className="secondary action-link-btn" href={`tel:${c.phone}`}>
                      Appeler
                    </a>
                  ) : null}
                  {c.email ? (
                    <a className="secondary action-link-btn" href={`mailto:${c.email}`}>
                      Email
                    </a>
                  ) : null}
                  <button type="button" className="danger" onClick={() => removeClient(c)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
