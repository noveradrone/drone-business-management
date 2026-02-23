import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: "",
    method: "Virement",
    reference: "",
    notes: ""
  });

  const [form, setForm] = useState({
    client_id: "",
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "draft",
    tax_rate: 20,
    currency: "EUR",
    notes: ""
  });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);

  async function load() {
    try {
      const [invoiceRows, clientRows] = await Promise.all([api.invoices.list(), api.clients.list()]);
      setInvoices(invoiceRows);
      setClients(clientRows);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadInvoiceDetails(invoiceId) {
    setLoadingDetails(true);
    setError("");
    try {
      const data = await api.invoices.get(invoiceId);
      setSelectedInvoice(data);
      setSelectedInvoiceId(invoiceId);
      const due = Math.max(0, Number(data.total || 0) - Number(data.amount_received || 0));
      setPaymentForm((prev) => ({ ...prev, amount: due ? due.toFixed(2) : "" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const text = `${i.invoice_number} ${i.company_name}`.toLowerCase();
      const matchQuery = text.includes(query.toLowerCase());
      const matchStatus = statusFilter === "all" ? true : i.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [invoices, query, statusFilter]);

  const financeKpi = useMemo(() => {
    const total = invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
    const received = invoices.reduce((sum, i) => sum + Number(i.amount_received || 0), 0);
    const due = Math.max(0, total - received);
    const overdue = invoices.filter((i) => i.status === "overdue").length;
    return { total, received, due, overdue };
  }, [invoices]);

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

    if (filteredItems.length === 0) {
      setError("Ajoute au moins une ligne d'article.");
      return;
    }

    setSubmitting(true);
    try {
      await api.invoices.create({
        ...form,
        client_id: Number(form.client_id),
        tax_rate: Number(form.tax_rate),
        items: filteredItems
      });
      setForm({
        client_id: "",
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
        tax_rate: 20,
        currency: "EUR",
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

  async function submitPayment(e) {
    e.preventDefault();
    if (!selectedInvoiceId) return;
    setError("");
    try {
      await api.invoices.addPayment(selectedInvoiceId, {
        ...paymentForm,
        amount: Number(paymentForm.amount)
      });
      await load();
      await loadInvoiceDetails(selectedInvoiceId);
      setPaymentForm((prev) => ({ ...prev, reference: "", notes: "" }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadInvoicePdf(invoice) {
    try {
      const blob = await api.invoices.pdf(invoice.id);
      download(blob, `facture-${invoice.invoice_number}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function downloadReceiptPdf(invoiceId, payment) {
    try {
      const blob = await api.invoices.paymentReceiptPdf(invoiceId, payment.id);
      download(blob, `recu-${invoiceId}-${payment.id}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeInvoice(invoice) {
    if (!window.confirm(`Supprimer la facture ${invoice.invoice_number} ?`)) return;
    setError("");
    try {
      await api.invoices.remove(invoice.id);
      if (selectedInvoiceId === invoice.id) {
        setSelectedInvoiceId(null);
        setSelectedInvoice(null);
      }
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const dueSelected = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.amount_received || 0))
    : 0;

  return (
    <div>
      <div className="page-head">
        <h2>Factures</h2>
        <span className="pill">Facture + paiements + recus</span>
      </div>

      <div className="card-grid">
        <div className="card">
          <p className="card-label">Total facture</p>
          <p className="card-value">{financeKpi.total.toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Encaisse</p>
          <p className="card-value">{financeKpi.received.toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Reste a payer</p>
          <p className="card-value">{financeKpi.due.toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Factures en retard</p>
          <p className="card-value">{financeKpi.overdue}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        <input placeholder="Numero facture" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required />
        <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required />
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">draft</option>
          <option value="sent">sent</option>
        </select>
        <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} placeholder="TVA %" />
        <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
        <input placeholder="Notes (optionnel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <div style={{ gridColumn: "1 / -1" }} className="card">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: "1rem" }}>Articles facture</h2>
            <button type="button" className="secondary" onClick={addItem}>Ajouter une ligne</button>
          </div>
          {items.map((item, index) => (
            <div key={index} className="line-item-row">
              <input placeholder="Description" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} required={index === 0} />
              <input type="number" min="0" step="0.01" placeholder="Qte" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Prix unitaire" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} />
              <button type="button" className="secondary" onClick={() => removeItem(index)} disabled={items.length === 1}>Suppr.</button>
            </div>
          ))}
        </div>

        <button style={{ gridColumn: "1 / -1" }} disabled={submitting}>{submitting ? "Creation..." : "Creer la facture"}</button>
      </form>

      <div className="card" style={{ margin: "14px 0" }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: "1rem" }}>Recherche factures</h2>
        </div>
        <div className="filter-row">
          <input placeholder="Recherche numero / client" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="draft">draft</option>
            <option value="sent">sent</option>
            <option value="partial">partial</option>
            <option value="paid">paid</option>
            <option value="overdue">overdue</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Client</th>
              <th>Date</th>
              <th>Echeance</th>
              <th>Statut</th>
              <th>Total</th>
              <th>Recu</th>
              <th>Reste</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((i) => {
              const due = Math.max(0, Number(i.total || 0) - Number(i.amount_received || 0));
              return (
                <tr key={i.id}>
                  <td>{i.invoice_number}</td>
                  <td>{i.company_name}</td>
                  <td>{i.invoice_date}</td>
                  <td>{i.due_date}</td>
                  <td>{i.status}</td>
                  <td>{Number(i.total || 0).toFixed(2)} {i.currency}</td>
                  <td>{Number(i.amount_received || 0).toFixed(2)} {i.currency}</td>
                  <td>{due.toFixed(2)} {i.currency}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="secondary" onClick={() => downloadInvoicePdf(i)}>PDF</button>
                    <button className="secondary" onClick={() => loadInvoiceDetails(i.id)}>Paiement</button>
                    <button type="button" className="secondary" onClick={() => removeInvoice(i)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedInvoiceId && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="page-head">
            <h2 style={{ fontSize: "1rem" }}>
              Encaissements facture {selectedInvoice?.invoice_number || selectedInvoiceId}
            </h2>
            {loadingDetails ? <span className="pill">Chargement...</span> : <span className="pill">Reste: {dueSelected.toFixed(2)} {selectedInvoice?.currency || "EUR"}</span>}
          </div>

          <form className="form-grid" onSubmit={submitPayment}>
            <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} required />
            <input type="number" min="0.01" step="0.01" placeholder="Montant" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
            <input placeholder="Mode (Virement, CB...)" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} />
            <input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
            <input placeholder="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            <button>Enregistrer paiement</button>
          </form>

          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedInvoice?.payments || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td>{Number(p.amount || 0).toFixed(2)} {selectedInvoice?.currency || "EUR"}</td>
                    <td>{p.method || "-"}</td>
                    <td>{p.reference || "-"}</td>
                    <td>
                      <button className="secondary" onClick={() => downloadReceiptPdf(selectedInvoiceId, p)}>Recu PDF</button>
                    </td>
                  </tr>
                ))}
                {selectedInvoice && selectedInvoice.payments && selectedInvoice.payments.length === 0 && (
                  <tr>
                    <td colSpan="5">Aucun paiement enregistre.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
