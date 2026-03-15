import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_META = {
  draft: { label: "Brouillon", color: "#f59e0b" },
  sent: { label: "Envoyee", color: "#2563eb" },
  partial: { label: "En attente", color: "#f97316" },
  paid: { label: "Payee", color: "#16a34a" },
  overdue: { label: "En retard", color: "#dc2626" },
  cancelled: { label: "Annulee", color: "#6b7280" }
};

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status || "-", color: "#6b7280" };
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 999,
        padding: "4px 10px",
        fontWeight: 700,
        fontSize: 12,
        background: `${meta.color}1A`,
        color: meta.color,
        border: `1px solid ${meta.color}55`
      }}
    >
      {meta.label}
    </span>
  );
}

export default function InvoicesPage() {
  const location = useLocation();
  const createSectionRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [articleForm, setArticleForm] = useState({
    name: "",
    description: "",
    price: "",
    tax_rate: 20
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: "",
    method: "Virement",
    reference: "",
    notes: ""
  });

  const [form, setForm] = useState({
    client_id: "",
    invoice_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "draft",
    tax_rate: 20,
    currency: "EUR",
    acompte_pourcentage: 0,
    acompte_montant: 0,
    notes: "",
    note_interne: ""
  });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);

  async function refreshNextNumber(dateValue) {
    try {
      const payload = await api.invoices.nextNumber(dateValue);
      setForm((prev) => ({ ...prev, invoice_number: payload.invoice_number || prev.invoice_number }));
    } catch {
      // Keep current value on failure.
    }
  }

  async function load() {
    try {
      const [invoiceRows, clientRows, articleRows, statsRows, me] = await Promise.all([
        api.invoices.list(),
        api.clients.list(),
        api.articles.list(),
        api.invoices.stats(),
        api.auth.me()
      ]);
      setInvoices(invoiceRows);
      setClients(clientRows);
      setArticles(articleRows);
      setStats(statsRows);
      setIsAdmin(me?.role === "admin");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    refreshNextNumber(form.invoice_date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const invoiceId = new URLSearchParams(location.search).get("invoice");
    if (!invoiceId || !invoices.some((invoice) => String(invoice.id) === String(invoiceId))) return;
    if (String(selectedInvoiceId || "") === String(invoiceId)) return;
    loadInvoiceDetails(invoiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, invoices, selectedInvoiceId]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const text = `${i.invoice_number} ${i.company_name}`.toLowerCase();
      const matchQuery = text.includes(query.toLowerCase());
      const matchStatus = statusFilter === "all" ? true : i.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [invoices, query, statusFilter]);

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function applyArticle(index, articleName) {
    const article = articles.find((a) => a.name === articleName);
    if (!article) {
      updateItem(index, "description", articleName);
      return;
    }
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              description: article.description || article.name,
              unit_price: Number(article.price || 0)
            }
          : item
      )
    );
    setForm((prev) => ({ ...prev, tax_rate: Number(article.tax_rate || prev.tax_rate) }));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const draftTotals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
    const total = subtotal + subtotal * (Number(form.tax_rate || 0) / 100);
    let acompte = Number(form.acompte_montant || 0);
    if (!acompte && Number(form.acompte_pourcentage || 0) > 0) {
      acompte = total * (Number(form.acompte_pourcentage || 0) / 100);
    }
    acompte = Math.min(total, Math.max(0, acompte));
    const solde = Math.max(0, total - acompte);
    return { subtotal, total, acompte, solde };
  }, [items, form.tax_rate, form.acompte_montant, form.acompte_pourcentage]);

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
        acompte_pourcentage: Number(form.acompte_pourcentage || 0),
        acompte_montant: Number(form.acompte_montant || 0),
        items: filteredItems
      });

      const nextDate = new Date().toISOString().slice(0, 10);
      const nextDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setForm({
        client_id: "",
        invoice_number: "",
        invoice_date: nextDate,
        due_date: nextDue,
        status: "draft",
        tax_rate: 20,
        currency: "EUR",
        acompte_pourcentage: 0,
        acompte_montant: 0,
        notes: "",
        note_interne: ""
      });
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      await refreshNextNumber(nextDate);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createArticle(e) {
    e.preventDefault();
    setError("");
    try {
      await api.articles.create({
        ...articleForm,
        price: Number(articleForm.price || 0),
        tax_rate: Number(articleForm.tax_rate || 20)
      });
      setArticleForm({ name: "", description: "", price: "", tax_rate: 20 });
      await load();
    } catch (e2) {
      setError(e2.message);
    }
  }

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

  async function markAsPaid(invoice) {
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.invoices.markPaid(invoice.id, {
        date_paiement: today,
        moyen_paiement: "Virement"
      });
      await load();
      const data = await api.invoices.get(invoice.id);
      setSelectedInvoice(data);
      setSelectedInvoiceId(invoice.id);
      if (data.payments && data.payments.length > 0) {
        const latest = data.payments[0];
        const blob = await api.invoices.paymentReceiptPdf(invoice.id, latest.id);
        download(blob, `recu-${invoice.invoice_number}-${latest.id}.pdf`);
      }
    } catch (e) {
      setError(e.message);
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
    <div className="invoices-page">
      <div className="page-head">
        <h2>Factures</h2>
        <button
          className="secondary"
          type="button"
          onClick={() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          Créer une facture
        </button>
      </div>
      <p className="page-summary">Suivi simple des factures, paiements et retards.</p>

      <div className="card-grid metrics-row">
        <div className="card">
          <p className="card-label">Total facture</p>
          <p className="card-value">{Number(stats?.total_facture || 0).toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Total restant</p>
          <p className="card-value">{Number(stats?.total_restant || 0).toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Factures en retard</p>
          <p className="card-value">{Number(stats?.factures_en_retard || 0)}</p>
        </div>
      </div>

      <details className="details-panel">
        <summary>Détails statistiques</summary>
        <div className="card-grid compact-grid">
          <div className="card">
            <p className="card-label">Total encaissé</p>
            <p className="card-value">{Number(stats?.total_encaisse || 0).toFixed(2)} EUR</p>
          </div>
          <div className="card">
            <p className="card-label">Délai moyen paiement</p>
            <p className="card-value">{Number(stats?.delai_moyen_paiement || 0).toFixed(1)} jours</p>
          </div>
        </div>
      </details>

      {error && <p className="error">{error}</p>}

      <details className="details-panel" open ref={createSectionRef}>
        <summary>Création facture</summary>
        <form className="form-grid" onSubmit={submit}>
          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
            <option value="">Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <input
            placeholder="Numero facture"
            value={form.invoice_number}
            onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.invoice_date}
            onChange={async (e) => {
              const v = e.target.value;
              setForm((prev) => ({ ...prev, invoice_date: v }));
              await refreshNextNumber(v);
            }}
            required
          />
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyee</option>
          </select>
          <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} placeholder="TVA %" />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <input placeholder="Acompte %" type="number" min="0" step="0.01" value={form.acompte_pourcentage} onChange={(e) => setForm({ ...form, acompte_pourcentage: e.target.value })} />
          <input placeholder="Acompte montant" type="number" min="0" step="0.01" value={form.acompte_montant} onChange={(e) => setForm({ ...form, acompte_montant: e.target.value })} />
          <input placeholder="Notes (PDF)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {isAdmin && (
            <input placeholder="Note interne (admin)" value={form.note_interne} onChange={(e) => setForm({ ...form, note_interne: e.target.value })} />
          )}

          <div style={{ gridColumn: "1 / -1" }} className="card">
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: "1rem" }}>Articles facture</h2>
              <button type="button" className="secondary" onClick={addItem}>
                Ajouter une ligne
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="line-item-row">
                <input
                  list="invoice-articles"
                  placeholder="Article ou description"
                  value={item.description}
                  onChange={(e) => applyArticle(index, e.target.value)}
                  required={index === 0}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Qte"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Prix unitaire"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                />
                <button type="button" className="secondary" onClick={() => removeItem(index)} disabled={items.length === 1}>
                  Suppr.
                </button>
              </div>
            ))}
            <datalist id="invoice-articles">
              {articles.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            <p style={{ margin: "8px 0 0", color: "#5b6473" }}>
              Brouillon: total {draftTotals.total.toFixed(2)} EUR, acompte {draftTotals.acompte.toFixed(2)} EUR, solde {draftTotals.solde.toFixed(2)} EUR
            </p>
          </div>

          <button className="primary-action" style={{ gridColumn: "1 / -1" }} disabled={submitting}>
            {submitting ? "Creation..." : "Creer la facture"}
          </button>
        </form>
      </details>

      <details className="details-panel">
        <summary>Articles prédéfinis (base)</summary>
        <form className="form-grid" onSubmit={createArticle}>
          <input placeholder="Article: nom" value={articleForm.name} onChange={(e) => setArticleForm({ ...articleForm, name: e.target.value })} required />
          <input placeholder="Article: description" value={articleForm.description} onChange={(e) => setArticleForm({ ...articleForm, description: e.target.value })} />
          <input type="number" min="0" step="0.01" placeholder="Article: prix" value={articleForm.price} onChange={(e) => setArticleForm({ ...articleForm, price: e.target.value })} required />
          <input type="number" min="0" step="0.01" placeholder="Article: TVA %" value={articleForm.tax_rate} onChange={(e) => setArticleForm({ ...articleForm, tax_rate: e.target.value })} />
          <button style={{ gridColumn: "1 / -1" }}>Ajouter article predefini</button>
        </form>
      </details>

      <div className="card" style={{ margin: "14px 0" }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: "1rem" }}>Liste des factures</h2>
        </div>
        <div className="filter-row">
          <input placeholder="Recherche numero / client" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyee</option>
            <option value="partial">En attente</option>
            <option value="paid">Payee</option>
            <option value="overdue">En retard</option>
          </select>
        </div>
      </div>

      <DataRowList
        items={filteredInvoices}
        emptyMessage="Aucune facture."
        renderTitle={(i) => i.invoice_number}
        renderSubtitle={(i) => i.company_name}
        renderDetails={(i) => {
          const due = Math.max(0, Number(i.total || 0) - Number(i.amount_received || 0));
          return (
            <div className="data-row-info-grid">
              <div className="data-row-info">
                <span className="data-row-label">Date</span>
                <span className="data-row-value">{i.invoice_date}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Echeance</span>
                <span className="data-row-value">{i.due_date}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Total</span>
                <span className="data-row-value">{Number(i.total || 0).toFixed(2)} {i.currency}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Recu</span>
                <span className="data-row-value">{Number(i.amount_received || 0).toFixed(2)} {i.currency}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Reste</span>
                <span className="data-row-value">{due.toFixed(2)} {i.currency}</span>
              </div>
            </div>
          );
        }}
        renderMeta={(i) => (
          <>
            {statusBadge(i.status)}
            <span className="data-row-chip">Relances: {i.nombre_relances || 0}</span>
          </>
        )}
        renderActions={(i) => (
          <>
            <button className="secondary" onClick={() => downloadInvoicePdf(i)}>PDF</button>
            <button className="secondary" onClick={() => loadInvoiceDetails(i.id)}>Paiement</button>
            {i.status !== "paid" && (
              <button type="button" className="secondary" onClick={() => markAsPaid(i)}>
                Marquer payee
              </button>
            )}
            <button type="button" className="danger" onClick={() => removeInvoice(i)}>
              Supprimer
            </button>
          </>
        )}
      />

      <details className="details-panel">
        <summary>Détails encaissements et impayés</summary>
        <div className="card-grid compact-grid" style={{ marginTop: 12 }}>
          <div className="card">
            <p className="card-label">Encaissements mensuels</p>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {(stats?.encaissements_mensuels || []).slice(0, 6).map((row) => (
                <div key={`enc-${row.month}`} style={{ display: "grid", gridTemplateColumns: "86px 1fr auto", gap: 8, alignItems: "center" }}>
                  <span>{row.month}</span>
                  <div style={{ height: 8, borderRadius: 99, background: "#e6eef8", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Number(row.amount || 0) / 100)}%`, height: "100%", background: "#0071e3" }} />
                  </div>
                  <span>{Number(row.amount || 0).toFixed(0)}€</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <p className="card-label">Factures impayees</p>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {(stats?.impayes_mensuels || []).slice(0, 6).map((row) => (
                <div key={`imp-${row.month}`} style={{ display: "grid", gridTemplateColumns: "86px 1fr auto", gap: 8, alignItems: "center" }}>
                  <span>{row.month}</span>
                  <div style={{ height: 8, borderRadius: 99, background: "#fde8e8", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Number(row.unpaid || 0) / 100)}%`, height: "100%", background: "#dc2626" }} />
                  </div>
                  <span>{Number(row.unpaid || 0).toFixed(0)}€</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {selectedInvoiceId && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="page-head">
            <h2 style={{ fontSize: "1rem" }}>
              Encaissements facture {selectedInvoice?.invoice_number || selectedInvoiceId}
            </h2>
            {loadingDetails ? (
              <span className="pill">Chargement...</span>
            ) : (
              <span className="pill">Reste: {dueSelected.toFixed(2)} {selectedInvoice?.currency || "EUR"}</span>
            )}
          </div>

          {selectedInvoice?.profitability && (
            <div className="card" style={{ marginBottom: 10 }}>
              <p className="card-label">Rentabilite mission liee</p>
              <p style={{ margin: 0 }}>
                Cout estime: {Number(selectedInvoice.profitability.cost_estimated || 0).toFixed(2)} EUR | Marge brute: {Number(selectedInvoice.profitability.gross_margin || 0).toFixed(2)} EUR | % marge: {Number(selectedInvoice.profitability.margin_percent || 0).toFixed(2)}%
              </p>
            </div>
          )}

          <form className="form-grid" onSubmit={submitPayment}>
            <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} required />
            <input type="number" min="0.01" step="0.01" placeholder="Montant" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
            <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              <option value="Virement">Virement</option>
              <option value="Especes">Especes</option>
              <option value="Stripe">Stripe</option>
              <option value="Autre">Autre</option>
            </select>
            <input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
            <input placeholder="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            <button className="primary-action">Enregistrer paiement</button>
          </form>

          <DataRowList
            items={selectedInvoice?.payments || []}
            emptyMessage="Aucun paiement enregistre."
            renderTitle={(p) => `${Number(p.amount || 0).toFixed(2)} ${selectedInvoice?.currency || "EUR"}`}
            renderSubtitle={(p) => p.payment_date}
            renderDetails={(p) => (
              <div className="data-row-info-grid">
                <div className="data-row-info">
                  <span className="data-row-label">Mode</span>
                  <span className="data-row-value">{p.method || "-"}</span>
                </div>
                <div className="data-row-info">
                  <span className="data-row-label">Reference</span>
                  <span className="data-row-value">{p.reference || "-"}</span>
                </div>
              </div>
            )}
            renderActions={(p) => (
              <button className="secondary" onClick={() => downloadReceiptPdf(selectedInvoiceId, p)}>
                Recu PDF
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}
