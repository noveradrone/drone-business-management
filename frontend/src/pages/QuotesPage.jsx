import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

const STATUS_META = {
  draft: { label: "Brouillon", color: "#f59e0b" },
  sent: { label: "Envoye", color: "#2563eb" },
  accepted: { label: "Accepte", color: "#16a34a" },
  rejected: { label: "Refuse", color: "#6b7280" },
  converted: { label: "Converti", color: "#7c3aed" },
  expired: { label: "Expire", color: "#dc2626" }
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultValidUntil() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildInitialForm() {
  return {
    client_id: "",
    quote_number: "",
    quote_date: todayIso(),
    valid_until: defaultValidUntil(),
    status: "draft",
    tax_rate: 20,
    currency: "EUR",
    discount_percent: 0,
    discount_amount: 0,
    acompte_percent: 0,
    acompte_amount: 0,
    notes: ""
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status || "-", color: "#6b7280" };
  return (
    <span
      className={`quote-status-badge quote-status-badge-${status || "default"}`}
      style={{
        "--quote-badge-color": meta.color,
        "--quote-badge-background": `${meta.color}14`,
        "--quote-badge-border": `${meta.color}45`
      }}
    >
      {meta.label}
    </span>
  );
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const createSectionRef = useRef(null);
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [form, setForm] = useState(buildInitialForm);
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);

  async function refreshNextNumber(dateValue) {
    if (editingQuoteId) return;
    try {
      const payload = await api.quotes.nextNumber(dateValue);
      setForm((prev) => ({ ...prev, quote_number: payload.quote_number || prev.quote_number }));
    } catch {
      // Keep current value on failure.
    }
  }

  async function load() {
    try {
      const [quoteRows, clientRows, articleRows, statsRows] = await Promise.all([
        api.quotes.list({
          q: query,
          status: statusFilter,
          from: periodFrom,
          to: periodTo,
          min: amountMin,
          max: amountMax
        }),
        api.clients.list(),
        api.articles.list(),
        api.quotes.stats()
      ]);
      setQuotes(quoteRows);
      setClients(clientRows);
      setArticles(articleRows);
      setStats(statsRows);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    refreshNextNumber(form.quote_date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, periodFrom, periodTo, amountMin, amountMax]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  async function beginEdit(quote) {
    setError("");
    try {
      const fullQuote = await api.quotes.get(quote.id);
      setEditingQuoteId(quote.id);
      setForm({
        client_id: String(fullQuote.client_id || ""),
        quote_number: fullQuote.quote_number || "",
        quote_date: fullQuote.quote_date || todayIso(),
        valid_until: fullQuote.valid_until || defaultValidUntil(),
        status: fullQuote.status || "draft",
        tax_rate: Number(fullQuote.tax_rate || 0),
        currency: fullQuote.currency || "EUR",
        discount_percent: Number(fullQuote.discount_percent || 0),
        discount_amount: Number(fullQuote.discount_amount || 0),
        acompte_percent: Number(fullQuote.acompte_percent || 0),
        acompte_amount: Number(fullQuote.acompte_amount || 0),
        notes: fullQuote.notes || ""
      });
      setItems(
        fullQuote.items?.length
          ? fullQuote.items.map((item) => ({
              description: item.description || "",
              quantity: Number(item.quantity || 1),
              unit_price: Number(item.unit_price || 0)
            }))
          : [{ description: "", quantity: 1, unit_price: 0 }]
      );
      createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetFormState() {
    const nextForm = buildInitialForm();
    setEditingQuoteId(null);
    setForm(nextForm);
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    await refreshNextNumber(nextForm.quote_date);
  }

  async function cancelEdit() {
    setError("");
    await resetFormState();
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
    let discount = Number(form.discount_amount || 0);
    if (!discount && Number(form.discount_percent || 0) > 0) {
      discount = subtotal * (Number(form.discount_percent || 0) / 100);
    }
    discount = Math.min(subtotal, Math.max(0, discount));
    const subtotalAfterDiscount = Math.max(0, subtotal - discount);
    const total = subtotalAfterDiscount + subtotalAfterDiscount * (Number(form.tax_rate || 0) / 100);

    let acompte = Number(form.acompte_amount || 0);
    if (!acompte && Number(form.acompte_percent || 0) > 0) {
      acompte = total * (Number(form.acompte_percent || 0) / 100);
    }
    acompte = Math.min(total, Math.max(0, acompte));
    return {
      subtotal,
      discount,
      total,
      acompte,
      balance: Math.max(0, total - acompte)
    };
  }, [items, form.discount_amount, form.discount_percent, form.tax_rate, form.acompte_amount, form.acompte_percent]);

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
      const payload = {
        ...form,
        client_id: Number(form.client_id),
        tax_rate: Number(form.tax_rate),
        discount_percent: Number(form.discount_percent || 0),
        discount_amount: Number(form.discount_amount || 0),
        acompte_percent: Number(form.acompte_percent || 0),
        acompte_amount: Number(form.acompte_amount || 0),
        items: filteredItems
      };

      if (editingQuoteId) {
        await api.quotes.update(editingQuoteId, payload);
      } else {
        await api.quotes.create(payload);
      }

      await resetFormState();
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

  async function previewPdf(quote) {
    try {
      setPreviewLoading(true);
      setError("");
      const blob = await api.quotes.pdf(quote.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setPreviewName(`devis-${quote.quote_number}.pdf`);
      setPreviewOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewName("");
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
  }

  async function sendQuote(quote) {
    setError("");
    try {
      await api.quotes.send(quote.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function convertQuote(quote) {
    if (!window.confirm("Transformer ce devis en facture ?")) return;
    setError("");
    try {
      const payload = await api.quotes.convertToInvoice(quote.id);
      await load();
      if (payload?.invoice?.id) {
        navigate(`/invoices?invoice=${payload.invoice.id}`);
      }
    } catch (e) {
      if (e.message === "Ce devis a deja ete converti en facture.") {
        const freshQuote = await api.quotes.get(quote.id).catch(() => null);
        if (freshQuote?.converted_invoice_id) {
          await load();
          navigate(`/invoices?invoice=${freshQuote.converted_invoice_id}`);
          return;
        }
      }
      setError(e.message);
    }
  }

  function openConvertedInvoice(quote) {
    if (!quote.converted_invoice_id) return;
    navigate(`/invoices?invoice=${quote.converted_invoice_id}`);
  }

  async function removeQuote(quote) {
    if (!window.confirm(`Supprimer le devis ${quote.quote_number} ?`)) return;
    setError("");
    try {
      await api.quotes.remove(quote.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="quotes-page">
      <div className="page-head">
        <h2>Devis</h2>
        <button
          className="secondary"
          type="button"
          onClick={() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          Creer devis
        </button>
      </div>
      <p className="page-summary">Module devis aligné sur Factures: statuts, filtres, PDF et conversion en facture.</p>

      <div className="card-grid metrics-row">
        <div className="card">
          <p className="card-label">Total devis</p>
          <p className="card-value">{Number(stats?.total_quotes || 0)}</p>
        </div>
        <div className="card">
          <p className="card-label">Envoyes</p>
          <p className="card-value">{Number(stats?.sent_quotes || 0)}</p>
        </div>
        <div className="card">
          <p className="card-label">Acceptes</p>
          <p className="card-value">{Number(stats?.accepted_quotes || 0)}</p>
        </div>
      </div>

      <details className="details-panel">
        <summary>Details statistiques</summary>
        <div className="card-grid compact-grid">
          <div className="card">
            <p className="card-label">Expires</p>
            <p className="card-value">{Number(stats?.expired_quotes || 0)}</p>
          </div>
          <div className="card">
            <p className="card-label">Montant cumule</p>
            <p className="card-value">{Number(stats?.total_amount || 0).toFixed(2)} EUR</p>
          </div>
        </div>
      </details>

      {error && <p className="error">{error}</p>}

      <details className="details-panel" open ref={createSectionRef}>
        <summary>{editingQuoteId ? "Modification devis" : "Creation devis"}</summary>
        <form className="form-grid" onSubmit={submit}>
          {editingQuoteId ? (
            <p className="section-note" style={{ gridColumn: "1 / -1" }}>
              Le devis selectionne est en cours de modification.
            </p>
          ) : null}
          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
            <option value="">Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <input value={form.quote_number} onChange={(e) => setForm({ ...form, quote_number: e.target.value })} placeholder="Numero devis" required />
          <input
            type="date"
            value={form.quote_date}
            onChange={async (e) => {
              const v = e.target.value;
              setForm((prev) => ({ ...prev, quote_date: v }));
              await refreshNextNumber(v);
            }}
            required
          />
          <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoye</option>
            <option value="accepted">Accepte</option>
            <option value="rejected">Refuse</option>
          </select>
          <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} placeholder="TVA %" />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <input type="number" min="0" step="0.01" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} placeholder="Remise %" />
          <input type="number" min="0" step="0.01" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} placeholder="Remise montant" />
          <input type="number" min="0" step="0.01" value={form.acompte_percent} onChange={(e) => setForm({ ...form, acompte_percent: e.target.value })} placeholder="Acompte %" />
          <input type="number" min="0" step="0.01" value={form.acompte_amount} onChange={(e) => setForm({ ...form, acompte_amount: e.target.value })} placeholder="Acompte montant" />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optionnel)" />

          <div style={{ gridColumn: "1 / -1" }} className="card">
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: "1rem" }}>Lignes devis</h2>
              <button type="button" className="secondary" onClick={addItem}>
                Ajouter une ligne
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="line-item-row">
                <input
                  list="quote-articles"
                  placeholder="Article ou description"
                  value={item.description}
                  onChange={(e) => applyArticle(index, e.target.value)}
                  required={index === 0}
                />
                <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} placeholder="Qte" />
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} placeholder="Prix unitaire" />
                <button type="button" className="secondary" onClick={() => removeItem(index)} disabled={items.length === 1}>
                  Suppr.
                </button>
              </div>
            ))}
            <datalist id="quote-articles">
              {articles.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            <p style={{ margin: "8px 0 0", color: "#5b6473" }}>
              Total brouillon: {totals.total.toFixed(2)} EUR, acompte: {totals.acompte.toFixed(2)} EUR, solde estime: {totals.balance.toFixed(2)} EUR
            </p>
          </div>

          <div className="form-actions quote-edit-actions" style={{ gridColumn: "1 / -1" }}>
            <button className="primary-action" disabled={submitting}>
              {submitting ? (editingQuoteId ? "Enregistrement..." : "Creation...") : editingQuoteId ? "Enregistrer le devis" : "Creer le devis"}
            </button>
            {editingQuoteId ? (
              <button type="button" className="secondary" onClick={cancelEdit} disabled={submitting}>
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      </details>

      <div className="card" style={{ margin: "14px 0" }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: "1rem" }}>Liste des devis</h2>
        </div>
        <div className="filter-row" style={{ marginBottom: 8 }}>
          <input placeholder="Recherche numero / client" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoye</option>
            <option value="accepted">Accepte</option>
            <option value="converted">Converti</option>
            <option value="rejected">Refuse</option>
            <option value="expired">Expire</option>
          </select>
        </div>
        <div className="form-grid">
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          <input placeholder="Montant min" type="number" min="0" step="0.01" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
          <input placeholder="Montant max" type="number" min="0" step="0.01" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
        </div>
      </div>

      <DataRowList
        items={quotes}
        className="quote-row-list"
        emptyMessage="Aucun devis."
        renderTitle={(q) => q.quote_number}
        renderSubtitle={(q) => q.company_name}
        renderDetails={(q) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Date</span>
              <span className="data-row-value">{q.quote_date}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Validite</span>
              <span className="data-row-value">{q.valid_until || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Total</span>
              <span className="data-row-value">
                {Number(q.total || 0).toFixed(2)} {q.currency || "EUR"}
              </span>
            </div>
          </div>
        )}
        renderMeta={(q) => (
          <>
            {statusBadge(q.status)}
            {q.converted_invoice_number ? <span className="data-row-chip">Facture {q.converted_invoice_number}</span> : null}
          </>
        )}
        renderActions={(q) => (
          <>
            <button type="button" className="secondary" onClick={() => beginEdit(q)}>
              Modifier
            </button>
            <button type="button" className="secondary" onClick={() => previewPdf(q)} disabled={previewLoading}>
              {previewLoading ? "Ouverture..." : "Previsualiser PDF"}
            </button>
            <button type="button" className="secondary" onClick={() => downloadPdf(q)}>Telecharger PDF</button>
            <button type="button" className="secondary" onClick={() => sendQuote(q)}>Envoyer</button>
            {q.converted_invoice_id ? (
              <button type="button" className="primary-action" onClick={() => openConvertedInvoice(q)}>
                Voir facture
              </button>
            ) : (
              <button type="button" className="primary-action" onClick={() => convertQuote(q)}>
                Convertir facture
              </button>
            )}
            <button type="button" className="danger" onClick={() => removeQuote(q)}>
              Supprimer
            </button>
          </>
        )}
      />

      {previewOpen && (
        <div className="modal-backdrop" onClick={closePreview}>
          <div className="modal-card modal-card-pdf" onClick={(e) => e.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: "1rem" }}>Previsualisation devis</h2>
              <div className="actions-cell">
                {previewUrl ? (
                  <a className="secondary" href={previewUrl} download={previewName}>
                    Telecharger PDF
                  </a>
                ) : null}
                <button type="button" className="secondary" onClick={closePreview}>
                  Fermer
                </button>
              </div>
            </div>
            {previewUrl ? (
              <iframe title="Previsualisation du devis" src={previewUrl} className="pdf-preview-frame" />
            ) : (
              <p>Aucune previsualisation disponible.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
