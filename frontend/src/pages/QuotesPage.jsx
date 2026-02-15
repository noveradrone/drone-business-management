import { useEffect, useState } from "react";
import { api } from "../api";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    quote_number: `DEV-${Date.now().toString().slice(-6)}`,
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "draft",
    tax_rate: 20,
    notes: ""
  });

  async function load() {
    try {
      const [quoteRows, clientRows] = await Promise.all([api.quotes.list(), api.clients.list()]);
      setQuotes(quoteRows);
      setClients(clientRows);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    const filteredItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim(),
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price)
      }));

    if (!filteredItems.length) {
      setError("Ajoute au moins une ligne d'article.");
      return;
    }

    setSubmitting(true);
    try {
      await api.quotes.create({
        ...form,
        client_id: Number(form.client_id),
        tax_rate: Number(form.tax_rate),
        items: filteredItems
      });
      setForm({
        client_id: "",
        quote_number: `DEV-${Date.now().toString().slice(-6)}`,
        quote_date: new Date().toISOString().slice(0, 10),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
        tax_rate: 20,
        notes: ""
      });
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadPdf(quote) {
    try {
      const blob = await api.quotes.pdf(quote.id);
      download(blob, `devis-${quote.quote_number}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Devis</h2>
        <span className="pill">PDF conforme FR (a verifier)</span>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        <input value={form.quote_number} onChange={(e) => setForm({ ...form, quote_number: e.target.value })} placeholder="Numero devis" required />
        <input type="date" value={form.quote_date} onChange={(e) => setForm({ ...form, quote_date: e.target.value })} required />
        <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} required />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">draft</option>
          <option value="sent">sent</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
        </select>
        <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} placeholder="TVA %" />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" />

        <div style={{ gridColumn: "1 / -1" }} className="card">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: "1rem" }}>Lignes devis</h2>
            <button type="button" className="secondary" onClick={addItem}>Ajouter une ligne</button>
          </div>
          {items.map((item, index) => (
            <div key={index} style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr auto", marginBottom: 8 }}>
              <input placeholder="Description" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} required={index === 0} />
              <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} placeholder="Qte" />
              <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} placeholder="Prix unitaire" />
              <button type="button" className="secondary" onClick={() => removeItem(index)} disabled={items.length === 1}>Suppr.</button>
            </div>
          ))}
        </div>

        <button style={{ gridColumn: "1 / -1" }} disabled={submitting}>{submitting ? "Creation..." : "Creer le devis"}</button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Client</th>
              <th>Date</th>
              <th>Validite</th>
              <th>Statut</th>
              <th>Total</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.quote_number}</td>
                <td>{q.company_name}</td>
                <td>{q.quote_date}</td>
                <td>{q.valid_until || "-"}</td>
                <td>{q.status}</td>
                <td>{Number(q.total || 0).toFixed(2)} EUR</td>
                <td>
                  <button className="secondary" onClick={() => downloadPdf(q)}>PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
