import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import CustomSelect from "../components/CustomSelect";
import DataRowList from "../components/DataRowList";
import SearchSelect from "../components/SearchSelect";
import SegmentedControl from "../components/SegmentedControl";

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

const WIZARD_STEPS = [
  { id: "client", label: "Client" },
  { id: "details", label: "Dossier" },
  { id: "pricing", label: "Prix" },
  { id: "preview", label: "Validation" }
];

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyee" }
];

const INVOICE_FILTER_OPTIONS = [
  { value: "all", label: "Tous statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyee" },
  { value: "partial", label: "En attente" },
  { value: "paid", label: "Payee" },
  { value: "overdue", label: "En retard" }
];

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR", icon: "🇪🇺" },
  { value: "USD", label: "USD", icon: "🇺🇸" },
  { value: "GBP", label: "GBP", icon: "🇬🇧" }
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "Virement", label: "Virement" },
  { value: "Especes", label: "Especes" },
  { value: "Stripe", label: "Stripe" },
  { value: "Autre", label: "Autre" }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildInitialForm() {
  return {
    client_id: "",
    invoice_number: "",
    invoice_date: todayIso(),
    due_date: defaultDueDate(),
    status: "draft",
    tax_rate: 20,
    currency: "EUR",
    acompte_pourcentage: 0,
    acompte_montant: 0,
    notes: "",
    note_interne: ""
  };
}

function formatMoney(value, currency = "EUR") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function formatDateFr(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(date);
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

export default function InvoicesPage() {
  const location = useLocation();
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [clientSearch, setClientSearch] = useState("");
  const [invoiceActionMenuId, setInvoiceActionMenuId] = useState(null);
  const [articleForm, setArticleForm] = useState({
    name: "",
    description: "",
    price: "",
    tax_rate: 20
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_date: todayIso(),
    amount: "",
    method: "Virement",
    reference: "",
    notes: ""
  });

  const [form, setForm] = useState(buildInitialForm);
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

  useEffect(() => {
    if (!invoiceActionMenuId) return undefined;
    function handleClose() {
      setInvoiceActionMenuId(null);
    }
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [invoiceActionMenuId]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const text = `${invoice.invoice_number} ${invoice.company_name}`.toLowerCase();
      const matchQuery = text.includes(query.toLowerCase());
      const matchStatus = statusFilter === "all" ? true : invoice.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [invoices, query, statusFilter]);

  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      `${client.company_name} ${client.contact_name || ""} ${client.email || ""} ${client.phone || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [clients, clientSearch]);

  const clientSelectOptions = useMemo(
    () =>
      filteredClients.map((client) => ({
        value: String(client.id),
        label: client.company_name,
        description: client.email || client.contact_name || "",
        meta: client.phone || "",
        avatar: (client.company_name || "?").slice(0, 2).toUpperCase()
      })),
    [filteredClients]
  );

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(form.client_id)) || null,
    [clients, form.client_id]
  );

  function resetWizardState() {
    const nextForm = buildInitialForm();
    setForm(nextForm);
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    setWizardStep(0);
    setClientSearch("");
    refreshNextNumber(nextForm.invoice_date);
  }

  function openCreateWizard() {
    setError("");
    resetWizardState();
    setDrawerOpen(true);
  }

  function closeWizard() {
    setDrawerOpen(false);
    resetWizardState();
  }

  function goToStep(index) {
    setWizardStep(index);
  }

  function nextStep() {
    if (wizardStep === 0 && !form.client_id) {
      setError("Choisis un client avant de continuer.");
      return;
    }
    if (wizardStep === 2 && !items.some((item) => String(item.description || "").trim())) {
      setError("Ajoute au moins une ligne d'article avant de continuer.");
      return;
    }
    setError("");
    setWizardStep((step) => Math.min(step + 1, WIZARD_STEPS.length - 1));
  }

  function previousStep() {
    setError("");
    setWizardStep((step) => Math.max(step - 1, 0));
  }

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function applyArticle(index, articleName) {
    const article = articles.find((articleEntry) => articleEntry.name === articleName);
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

  function buildFilteredItems() {
    return items
      .filter((item) => String(item.description || "").trim())
      .map((item) => ({
        description: String(item.description || "").trim(),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }));
  }

  const draftTotals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
    const total = subtotal + subtotal * (Number(form.tax_rate || 0) / 100);
    let acompte = Number(form.acompte_montant || 0);
    if (!acompte && Number(form.acompte_pourcentage || 0) > 0) {
      acompte = total * (Number(form.acompte_pourcentage || 0) / 100);
    }
    acompte = Math.min(total, Math.max(0, acompte));
    const solde = Math.max(0, total - acompte);
    return { subtotal, total, acompte, solde };
  }, [items, form.tax_rate, form.acompte_montant, form.acompte_pourcentage]);

  async function persistInvoice(overrides = {}) {
    const filteredItems = buildFilteredItems();
    if (!form.client_id) {
      setError("Choisis un client avant d'enregistrer la facture.");
      setWizardStep(0);
      return null;
    }
    if (!filteredItems.length) {
      setError("Ajoute au moins une ligne d'article.");
      setWizardStep(2);
      return null;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
        ...overrides,
        client_id: Number(form.client_id),
        tax_rate: Number(form.tax_rate),
        acompte_pourcentage: Number(form.acompte_pourcentage || 0),
        acompte_montant: Number(form.acompte_montant || 0),
        items: filteredItems
      };
      const created = await api.invoices.create(payload);
      await load();
      return created || null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDraft() {
    const created = await persistInvoice({ status: "draft" });
    if (!created) return;
    closeWizard();
  }

  async function createInvoice() {
    const created = await persistInvoice();
    if (!created) return;
    closeWizard();
    if (created?.id) {
      await loadInvoiceDetails(created.id);
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
      const today = todayIso();
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

  function getPrimaryInvoiceAction(invoice) {
    if (invoice.status === "paid") {
      return {
        label: "Voir",
        className: "secondary",
        onClick: () => loadInvoiceDetails(invoice.id)
      };
    }

    return {
      label: "Paiement",
      className: "primary-action",
      onClick: () => loadInvoiceDetails(invoice.id)
    };
  }

  return (
    <div className="invoices-page">
      <div className="page-header">
        <div>
          <p className="login-eyebrow">Finance</p>
        </div>
        <h2 className="page-title">Factures simples a creer et a suivre</h2>
        <div className="page-action">
          <button type="button" className="primary-action" onClick={openCreateWizard}>
            + Creer une facture
          </button>
        </div>
      </div>

      <p className="page-summary">
        La creation de facture suit maintenant le meme principe que les devis: moins de champs d'un coup, plus de
        clarte, et un resume vivant a droite.
      </p>

      <section className="summary-band quote-kpi-band">
        <div className="summary-band-grid quote-kpi-grid">
          <div className="summary-band-item">
            <span className="card-label">Total facture</span>
            <strong>{formatMoney(stats?.total_facture || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Total restant</span>
            <strong>{formatMoney(stats?.total_restant || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Factures en retard</span>
            <strong>{Number(stats?.factures_en_retard || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Encaisse</span>
            <strong>{formatMoney(stats?.total_encaisse || 0)}</strong>
          </div>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="card toolbar-card">
        <div>
          <p className="card-label">Pilotage facturation</p>
          <h3>Retrouve vite une facture, un client ou un statut avant de passer au paiement.</h3>
        </div>
        <div className="inline-filters">
          <input placeholder="Recherche numero / client" value={query} onChange={(e) => setQuery(e.target.value)} />
          <CustomSelect value={statusFilter} onChange={setStatusFilter} options={INVOICE_FILTER_OPTIONS} />
        </div>
      </section>

      <DataRowList
        items={filteredInvoices}
        className="quote-row-list invoice-row-list"
        emptyMessage="Aucune facture."
        renderTitle={(invoice) => invoice.invoice_number}
        renderSubtitle={(invoice) => invoice.company_name}
        renderDetails={(invoice) => {
          const due = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_received || 0));
          return (
            <div className="data-row-info-grid">
              <div className="data-row-info">
                <span className="data-row-label">Date</span>
                <span className="data-row-value">{formatDateFr(invoice.invoice_date)}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Echeance</span>
                <span className="data-row-value">{formatDateFr(invoice.due_date)}</span>
              </div>
              <div className="data-row-info">
                <span className="data-row-label">Montants</span>
                <span className="data-row-value">{formatMoney(invoice.total || 0, invoice.currency || "EUR")}</span>
                <span className="muted-copy">Recu {formatMoney(invoice.amount_received || 0, invoice.currency || "EUR")}</span>
                <span className="muted-copy">Reste {formatMoney(due, invoice.currency || "EUR")}</span>
              </div>
            </div>
          );
        }}
        renderMeta={(invoice) => (
          <>
            {statusBadge(invoice.status)}
            <span className="data-row-chip">Relances: {invoice.nombre_relances || 0}</span>
          </>
        )}
        renderActions={(invoice) => {
          const primaryAction = getPrimaryInvoiceAction(invoice);
          const menuOpen = invoiceActionMenuId === invoice.id;
          return (
            <div className="quote-card-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className={primaryAction.className} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
              <div className={`quote-actions-menu ${menuOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="quote-actions-menu__trigger"
                  aria-label="Ouvrir les actions de la facture"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvoiceActionMenuId((current) => (current === invoice.id ? null : invoice.id));
                  }}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="quote-actions-menu__panel">
                    <button type="button" className="quote-actions-menu__item" onClick={() => loadInvoiceDetails(invoice.id)}>
                      Voir encaissements
                    </button>
                    <button type="button" className="quote-actions-menu__item" onClick={() => downloadInvoicePdf(invoice)}>
                      Telecharger PDF
                    </button>
                    {invoice.status !== "paid" ? (
                      <button type="button" className="quote-actions-menu__item" onClick={() => markAsPaid(invoice)}>
                        Marquer payee
                      </button>
                    ) : null}
                    <button type="button" className="quote-actions-menu__item is-danger" onClick={() => removeInvoice(invoice)}>
                      Supprimer
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        }}
      />

      <details className="details-panel">
        <summary>Articles prédéfinis (base)</summary>
        <form className="form-grid" onSubmit={createArticle}>
          <input
            placeholder="Article: nom"
            value={articleForm.name}
            onChange={(e) => setArticleForm({ ...articleForm, name: e.target.value })}
            required
          />
          <input
            placeholder="Article: description"
            value={articleForm.description}
            onChange={(e) => setArticleForm({ ...articleForm, description: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Article: prix"
            value={articleForm.price}
            onChange={(e) => setArticleForm({ ...articleForm, price: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Article: TVA %"
            value={articleForm.tax_rate}
            onChange={(e) => setArticleForm({ ...articleForm, tax_rate: e.target.value })}
          />
          <button style={{ gridColumn: "1 / -1" }}>Ajouter article predefini</button>
        </form>
      </details>

      {selectedInvoiceId ? (
        <div className="card invoice-payment-panel">
          <div className="page-head invoice-payment-head">
            <h2 style={{ fontSize: "1rem" }}>Encaissements facture {selectedInvoice?.invoice_number || selectedInvoiceId}</h2>
            {loadingDetails ? (
              <span className="pill">Chargement...</span>
            ) : (
              <span className="pill invoice-balance-pill">
                Reste: {dueSelected.toFixed(2)} {selectedInvoice?.currency || "EUR"}
              </span>
            )}
          </div>

          {selectedInvoice?.profitability ? (
            <div className="card" style={{ marginBottom: 10 }}>
              <p className="card-label">Rentabilite mission liee</p>
              <p style={{ margin: 0 }}>
                Cout estime: {Number(selectedInvoice.profitability.cost_estimated || 0).toFixed(2)} EUR | Marge brute:{" "}
                {Number(selectedInvoice.profitability.gross_margin || 0).toFixed(2)} EUR | % marge:{" "}
                {Number(selectedInvoice.profitability.margin_percent || 0).toFixed(2)}%
              </p>
            </div>
          ) : null}

          <form className="form-grid invoice-payment-form" onSubmit={submitPayment}>
            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Montant"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              required
            />
            <CustomSelect value={paymentForm.method} onChange={(next) => setPaymentForm({ ...paymentForm, method: next })} options={PAYMENT_METHOD_OPTIONS} />
            <input
              placeholder="Reference"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />
            <input placeholder="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            <button className="primary-action invoice-payment-submit">Enregistrer paiement</button>
          </form>

          <DataRowList
            items={selectedInvoice?.payments || []}
            className="payment-row-list"
            emptyMessage="Aucun paiement enregistre."
            renderTitle={(payment) => `${Number(payment.amount || 0).toFixed(2)} ${selectedInvoice?.currency || "EUR"}`}
            renderSubtitle={(payment) => payment.payment_date}
            renderDetails={(payment) => (
              <div className="data-row-info-grid">
                <div className="data-row-info">
                  <span className="data-row-label">Mode</span>
                  <span className="data-row-value">{payment.method || "-"}</span>
                </div>
                <div className="data-row-info">
                  <span className="data-row-label">Reference</span>
                  <span className="data-row-value">{payment.reference || "-"}</span>
                </div>
              </div>
            )}
            renderActions={(payment) => (
              <button className="secondary" onClick={() => downloadReceiptPdf(selectedInvoiceId, payment)}>
                Recu PDF
              </button>
            )}
          />
        </div>
      ) : null}

      {drawerOpen ? (
        <div className="modal-backdrop" onClick={closeWizard}>
          <aside className="drawer-sheet drawer-sheet-wide quote-wizard-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header quote-wizard-header">
              <div>
                <p className="card-label">Assistant facture</p>
                <h3>Creer une facture sans formulaire geant</h3>
                <p>
                  Meme logique que pour les devis: on avance par etapes, on garde un resume vivant a droite et on
                  valide seulement ce qui est utile.
                </p>
              </div>
              <button type="button" className="btn btn-ghost drawer-close" onClick={closeWizard}>
                ✕
              </button>
            </div>

            <div className="quote-wizard-progress">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  className={`quote-step-pill ${wizardStep === index ? "is-active" : ""} ${
                    wizardStep > index ? "is-complete" : ""
                  }`}
                  onClick={() => goToStep(index)}
                >
                  <span className="quote-step-pill__index">{index + 1}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            <div className="quote-wizard-layout">
              <section className="form-section quote-wizard-main">
                {wizardStep === 0 ? (
                  <>
                    <p className="form-section-title">Etape 1 · Choix du client</p>
                    <div className="quote-wizard-copy">
                      <p>Selectionne le client d'abord. Toute la facture se preparera ensuite avec le bon contexte.</p>
                    </div>
                    <input placeholder="Rechercher un client" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                    <SearchSelect
                      value={form.client_id}
                      onChange={(next) => setForm((prev) => ({ ...prev, client_id: next }))}
                      options={clientSelectOptions}
                      placeholder="Choisir un client"
                      searchPlaceholder="Rechercher un client"
                      emptyText="Aucun client trouve"
                    />
                  </>
                ) : null}

                {wizardStep === 1 ? (
                  <>
                    <p className="form-section-title">Etape 2 · Dossier rapide</p>
                    <div className="quote-wizard-copy">
                      <p>Renseigne les dates, le statut et les notes utiles avant de passer au prix.</p>
                    </div>
                    <div className="form-grid-2">
                      <input
                        type="date"
                        value={form.invoice_date}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setForm((prev) => ({ ...prev, invoice_date: value }));
                          await refreshNextNumber(value);
                        }}
                      />
                      <input type="date" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
                      <input
                        placeholder="Numero facture"
                        value={form.invoice_number}
                        onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                      />
                      <SegmentedControl value={form.status} onChange={(next) => setForm((prev) => ({ ...prev, status: next }))} options={INVOICE_STATUS_OPTIONS} />
                    </div>
                    <textarea
                      placeholder="Notes visibles sur la facture"
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                    {isAdmin ? (
                      <textarea
                        placeholder="Note interne (admin uniquement)"
                        value={form.note_interne}
                        onChange={(e) => setForm((prev) => ({ ...prev, note_interne: e.target.value }))}
                      />
                    ) : null}
                  </>
                ) : null}

                {wizardStep === 2 ? (
                  <>
                    <div className="page-head quote-pricing-head">
                      <h3>Etape 3 · Prix et articles</h3>
                      <button type="button" className="secondary" onClick={addItem}>
                        + Ligne
                      </button>
                    </div>
                    <div className="quote-line-list">
                      {items.map((item, index) => (
                        <div key={index} className="quote-line-card">
                          <div className="quote-line-card__head">
                            <strong>Ligne {index + 1}</strong>
                            <button type="button" className="ghost" onClick={() => removeItem(index)} disabled={items.length === 1}>
                              Retirer
                            </button>
                          </div>
                          <div className="quote-line-grid">
                            <input
                              list="invoice-articles"
                              placeholder="Article ou description"
                              value={item.description}
                              onChange={(e) => applyArticle(index, e.target.value)}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Quantite"
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
                          </div>
                        </div>
                      ))}
                    </div>
                    <datalist id="invoice-articles">
                      {articles.map((article) => (
                        <option key={article.id} value={article.name} />
                      ))}
                    </datalist>
                    <div className="quote-price-grid">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="TVA %"
                        value={form.tax_rate}
                        onChange={(e) => setForm((prev) => ({ ...prev, tax_rate: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Acompte %"
                        value={form.acompte_pourcentage}
                        onChange={(e) => setForm((prev) => ({ ...prev, acompte_pourcentage: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Acompte montant"
                        value={form.acompte_montant}
                        onChange={(e) => setForm((prev) => ({ ...prev, acompte_montant: e.target.value }))}
                      />
                      <CustomSelect
                        compact
                        value={form.currency}
                        onChange={(next) => setForm((prev) => ({ ...prev, currency: next }))}
                        options={CURRENCY_OPTIONS}
                      />
                    </div>
                  </>
                ) : null}

                {wizardStep === 3 ? (
                  <>
                    <p className="form-section-title">Etape 4 · Validation finale</p>
                    <div className="quote-preview-block">
                      <div className="quote-preview-section">
                        <span className="data-row-label">Client</span>
                        <strong>{selectedClient?.company_name || "Aucun client choisi"}</strong>
                        <span className="muted-copy">
                          {selectedClient?.contact_name || "Contact non renseigne"}
                          {selectedClient?.email ? ` · ${selectedClient.email}` : ""}
                        </span>
                      </div>
                      <div className="quote-preview-section">
                        <span className="data-row-label">Facturation</span>
                        <strong>{form.invoice_number || "Numero a definir"}</strong>
                        <span className="muted-copy">
                          Facture du {formatDateFr(form.invoice_date)} · echeance {formatDateFr(form.due_date)}
                        </span>
                      </div>
                      <div className="quote-preview-lines">
                        {buildFilteredItems().map((item, index) => (
                          <div key={`${item.description}-${index}`} className="quote-preview-line">
                            <span>{item.description}</span>
                            <span>
                              {Number(item.quantity || 0)} × {formatMoney(item.unit_price || 0, form.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </section>

              <aside className="card quote-summary-card">
                <p className="card-label">Resume de la facture</p>
                <div className="quote-summary-stack">
                  <div className="quote-summary-row">
                    <span>Numero</span>
                    <strong>{form.invoice_number || "-"}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Client</span>
                    <strong>{selectedClient?.company_name || "A selectionner"}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Sous-total</span>
                    <strong>{formatMoney(draftTotals.subtotal, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Total TTC</span>
                    <strong>{formatMoney(draftTotals.total, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Acompte</span>
                    <strong>{formatMoney(draftTotals.acompte, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row quote-summary-row-balance">
                    <span>Solde</span>
                    <strong>{formatMoney(draftTotals.solde, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-meta">
                    {statusBadge(form.status)}
                    <span className="data-row-chip">{buildFilteredItems().length} ligne(s)</span>
                  </div>
                </div>
              </aside>
            </div>

            <div className="quote-wizard-actions">
              <button type="button" className="secondary" onClick={closeWizard}>
                Annuler
              </button>
              <div className="quote-wizard-actions__group">
                {wizardStep > 0 ? (
                  <button type="button" className="secondary" onClick={previousStep}>
                    Retour
                  </button>
                ) : null}
                {wizardStep < WIZARD_STEPS.length - 1 ? (
                  <button type="button" className="primary-action" onClick={nextStep}>
                    Continuer
                  </button>
                ) : (
                  <>
                    <button type="button" className="secondary" onClick={saveDraft} disabled={submitting}>
                      {submitting ? "Enregistrement..." : "Enregistrer brouillon"}
                    </button>
                    <button type="button" className="primary-action" onClick={createInvoice} disabled={submitting}>
                      {submitting ? "Creation..." : "Creer la facture"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
