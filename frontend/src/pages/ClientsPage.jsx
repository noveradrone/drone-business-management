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
    vat_number: ""
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
        vat_number: ""
      });
      load();
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
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Adresse de facturation" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
        <input placeholder="SIRET client" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
        <input placeholder="TVA client" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
        <button style={{ gridColumn: "1 / -1" }}>Ajouter</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>SIRET</th>
              <th>TVA</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.company_name}</td>
                <td>{c.contact_name || "-"}</td>
                <td>{c.email || "-"}</td>
                <td>{c.phone || "-"}</td>
                <td>{c.siret || "-"}</td>
                <td>{c.vat_number || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
