import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import CustomSelect from "../components/CustomSelect";
import DataRowList from "../components/DataRowList";
import SearchSelect from "../components/SearchSelect";
import SegmentedControl from "../components/SegmentedControl";

const STATUS_META = {
  draft: { label: "Brouillon", color: "#f59e0b" },
  sent: { label: "Envoye", color: "#2563eb" },
  accepted: { label: "Accepte", color: "#16a34a" },
  rejected: { label: "Refuse", color: "#6b7280" },
  converted: { label: "Converti", color: "#7c3aed" },
  expired: { label: "Expire", color: "#dc2626" }
};

const WIZARD_STEPS = [
  { id: "client", label: "Client" },
  { id: "details", label: "Details" },
  { id: "pricing", label: "Prix" },
  { id: "preview", label: "Apercu" }
];

const QUOTE_STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoye" },
  { value: "accepted", label: "Accepte" },
  { value: "rejected", label: "Refuse" }
];

const QUOTE_FILTER_OPTIONS = [
  { value: "all", label: "Tous statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoye" },
  { value: "accepted", label: "Accepte" },
  { value: "converted", label: "Converti" },
  { value: "rejected", label: "Refuse" },
  { value: "expired", label: "Expire" }
];

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR", icon: "🇪🇺" },
  { value: "USD", label: "USD", icon: "🇺🇸" },
  { value: "GBP", label: "GBP", icon: "🇬🇧" }
];

const QUICK_CLIENT_INITIAL = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  billing_address: "",
  siret: "",
  vat_number: "",
  source_channel: "Direct",
  is_prospect: 0
};

const EMPTY_CONTEXT = {
  service_date: "",
  service_location: "",
  estimated_duration: "",
  client_note: ""
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

function buildInitialContext() {
  return { ...EMPTY_CONTEXT };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildContextBlock(context) {
  const lines = [];
  if (normalizeText(context.service_date)) lines.push(`Date intervention: ${normalizeText(context.service_date)}`);
  if (normalizeText(context.service_location)) lines.push(`Lieu: ${normalizeText(context.service_location)}`);
  if (normalizeText(context.estimated_duration)) lines.push(`Duree estimee: ${normalizeText(context.estimated_duration)}`);
  if (normalizeText(context.client_note)) lines.push(`Note client: ${normalizeText(context.client_note)}`);
  return lines;
}

function mergeNotesWithContext(notes, context) {
  const contextLines = buildContextBlock(context);
  const cleanNotes = normalizeText(notes);
  if (!contextLines.length) return cleanNotes;
  return [...contextLines, cleanNotes].filter(Boolean).join("\n");
}

function extractContextFromNotes(notes) {
  const lines = String(notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const context = buildInitialContext();
  const freeNotes = [];

  lines.forEach((line) => {
    if (line.startsWith("Date intervention:")) {
      context.service_date = line.replace("Date intervention:", "").trim();
      return;
    }
    if (line.startsWith("Lieu:")) {
      context.service_location = line.replace("Lieu:", "").trim();
      return;
    }
    if (line.startsWith("Duree estimee:")) {
      context.estimated_duration = line.replace("Duree estimee:", "").trim();
      return;
    }
    if (line.startsWith("Note client:")) {
      context.client_note = line.replace("Note client:", "").trim();
      return;
    }
    freeNotes.push(line);
  });

  return {
    context,
    notes: freeNotes.join("\n")
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

function formatMoney(value, currency = "EUR") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function formatDateFr(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

export default function QuotesPage() {
  const navigate = useNavigate();
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
  const [quoteActionMenuId, setQuoteActionMenuId] = useState(null);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [clientSearch, setClientSearch] = useState("");
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState(QUICK_CLIENT_INITIAL);
  const [form, setForm] = useState(buildInitialForm);
  const [context, setContext] = useState(buildInitialContext);
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);

  async function refreshNextNumber(dateValue) {
    if (editingQuoteId) return;
    try {
      const payload = await api.quotes.nextNumber(dateValue);
      setForm((prev) => ({ ...prev, quote_number: payload.quote_number || prev.quote_number }));
    } catch {
      // keep current value
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

  useEffect(() => {
    if (!quoteActionMenuId) return undefined;
    function handleClose() {
      setQuoteActionMenuId(null);
    }
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [quoteActionMenuId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
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
  }, [form.acompte_amount, form.acompte_percent, form.discount_amount, form.discount_percent, form.tax_rate, items]);

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(form.client_id)) || null,
    [clients, form.client_id]
  );

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

  function resetWizardState() {
    const nextForm = buildInitialForm();
    setEditingQuoteId(null);
    setForm(nextForm);
    setContext(buildInitialContext());
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    setWizardStep(0);
    setClientSearch("");
    setQuickClientOpen(false);
    setQuickClientForm(QUICK_CLIENT_INITIAL);
    refreshNextNumber(nextForm.quote_date);
  }

  function openCreateWizard() {
    setError("");
    resetWizardState();
    setDrawerOpen(true);
  }

  function closeWizard() {
    setDrawerOpen(false);
    setPreviewOpen(false);
    resetWizardState();
  }

  async function beginEdit(quote) {
    setError("");
    try {
      const fullQuote = await api.quotes.get(quote.id);
      const extracted = extractContextFromNotes(fullQuote.notes || "");
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
        notes: extracted.notes || ""
      });
      setContext(extracted.context);
      setItems(
        fullQuote.items?.length
          ? fullQuote.items.map((item) => ({
              description: item.description || "",
              quantity: Number(item.quantity || 1),
              unit_price: Number(item.unit_price || 0)
            }))
          : [{ description: "", quantity: 1, unit_price: 0 }]
      );
      setWizardStep(0);
      setClientSearch("");
      setQuickClientOpen(false);
      setQuickClientForm(QUICK_CLIENT_INITIAL);
      setDrawerOpen(true);
    } catch (e) {
      setError(e.message);
    }
  }

  function updateItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function applyArticle(index, articleName) {
    const article = articles.find((entry) => entry.name === articleName);
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
      .filter((item) => normalizeText(item.description))
      .map((item) => ({
        description: normalizeText(item.description),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }));
  }

  function buildPayload() {
    return {
      ...form,
      client_id: Number(form.client_id),
      tax_rate: Number(form.tax_rate),
      discount_percent: Number(form.discount_percent || 0),
      discount_amount: Number(form.discount_amount || 0),
      acompte_percent: Number(form.acompte_percent || 0),
      acompte_amount: Number(form.acompte_amount || 0),
      notes: mergeNotesWithContext(form.notes, context),
      items: buildFilteredItems()
    };
  }

  async function persistQuote() {
    const filteredItems = buildFilteredItems();
    if (!form.client_id) {
      setError("Choisis un client avant d'enregistrer le devis.");
      setWizardStep(0);
      return null;
    }
    if (!filteredItems.length) {
      setError("Ajoute au moins une ligne de prestation.");
      setWizardStep(3);
      return null;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload();
      const result = editingQuoteId ? await api.quotes.update(editingQuoteId, payload) : await api.quotes.create(payload);
      const quoteRecord = result?.id ? result : null;
      await load();
      return quoteRecord || (editingQuoteId ? await api.quotes.get(editingQuoteId) : null);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDraft() {
    const quoteRecord = await persistQuote();
    if (!quoteRecord) return;
    closeWizard();
  }

  async function saveAndDownloadPdf() {
    const quoteRecord = await persistQuote();
    if (!quoteRecord?.id) return;
    try {
      const blob = await api.quotes.pdf(quoteRecord.id);
      download(blob, `devis-${quoteRecord.quote_number || form.quote_number}.pdf`);
      closeWizard();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveAndSendQuote() {
    const quoteRecord = await persistQuote();
    if (!quoteRecord?.id) return;
    try {
      await api.quotes.send(quoteRecord.id);
      await load();
      closeWizard();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitQuickClient(e) {
    e.preventDefault();
    setError("");
    try {
      const created = await api.clients.create(quickClientForm);
      await load();
      setForm((prev) => ({ ...prev, client_id: String(created.id) }));
      setQuickClientOpen(false);
      setQuickClientForm(QUICK_CLIENT_INITIAL);
      setWizardStep(1);
    } catch (e2) {
      setError(e2.message);
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

  function goToStep(index) {
    setWizardStep(index);
  }

  function getPrimaryQuoteAction(quote) {
    if (quote.converted_invoice_id) {
      return {
        label: "Voir",
        className: "secondary",
        onClick: () => openConvertedInvoice(quote)
      };
    }

    if (quote.status === "sent" || quote.status === "accepted") {
      return {
        label: "Voir",
        className: "secondary",
        onClick: () => previewPdf(quote)
      };
    }

    return {
      label: "Modifier",
      className: "primary-action",
      onClick: () => beginEdit(quote)
    };
  }

  function nextStep() {
    if (wizardStep === 0 && !form.client_id) {
      setError("Choisis ou cree un client avant de continuer.");
      return;
    }
    if (wizardStep === 2 && !normalizeText(items[0]?.description)) {
      setError("Renseigne au moins une ligne de prestation.");
      return;
    }
    setError("");
    setWizardStep((step) => Math.min(step + 1, WIZARD_STEPS.length - 1));
  }

  function previousStep() {
    setError("");
    setWizardStep((step) => Math.max(step - 1, 0));
  }

  return (
    <div className="quotes-page">
      <div className="page-header">
        <div>
          <p className="login-eyebrow">Finance</p>
        </div>
        <h2 className="page-title">Devis simples et rapides a creer</h2>
        <div className="page-action">
          <button type="button" className="primary-action" onClick={openCreateWizard}>
            + Creer un devis
          </button>
        </div>
      </div>

      <p className="page-summary">
        Une interface guidee pour preparer un devis propre en quelques etapes, sans noyer l'utilisateur dans un
        formulaire geant.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <section className="summary-band quote-kpi-band">
        <div className="summary-band-grid quote-kpi-grid">
          <div className="summary-band-item">
            <span className="card-label">Total devis</span>
            <strong>{Number(stats?.total_quotes || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Envoyes</span>
            <strong>{Number(stats?.sent_quotes || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Acceptes</span>
            <strong>{Number(stats?.accepted_quotes || 0)}</strong>
          </div>
          <div className="summary-band-item">
            <span className="card-label">Montant potentiel</span>
            <strong>{formatMoney(stats?.total_amount || 0)}</strong>
          </div>
        </div>
      </section>

      <section className="card toolbar-card">
        <div>
          <p className="card-label">Pilotage commercial</p>
          <h3>Retrouve vite un devis, un client ou une plage de montant.</h3>
        </div>
        <div className="inline-filters">
          <input
            placeholder="Recherche numero ou client"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CustomSelect value={statusFilter} onChange={setStatusFilter} options={QUOTE_FILTER_OPTIONS} />
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          <input
            placeholder="Montant min"
            type="number"
            min="0"
            step="0.01"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
          />
          <input
            placeholder="Montant max"
            type="number"
            min="0"
            step="0.01"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
          />
        </div>
      </section>

      <DataRowList
        items={quotes}
        className="quote-row-list"
        emptyMessage="Aucun devis."
        getItemClassName={(quote) => (quoteActionMenuId === quote.id ? "has-open-menu" : "")}
        renderTitle={(quote) => quote.quote_number}
        renderSubtitle={(quote) => quote.company_name}
        renderDetails={(quote) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Date</span>
              <span className="data-row-value">{formatDateFr(quote.quote_date)}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Validite</span>
              <span className="data-row-value">{formatDateFr(quote.valid_until)}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Total</span>
              <span className="data-row-value">{formatMoney(quote.total || 0, quote.currency || "EUR")}</span>
            </div>
          </div>
        )}
        renderMeta={(quote) => (
          <>
            {statusBadge(quote.status)}
            {quote.converted_invoice_number ? <span className="data-row-chip">Facture {quote.converted_invoice_number}</span> : null}
          </>
        )}
        renderActions={(quote) => {
          const primaryAction = getPrimaryQuoteAction(quote);
          const menuOpen = quoteActionMenuId === quote.id;
          return (
            <div className="quote-card-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className={primaryAction.className} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
              <div className={`quote-actions-menu ${menuOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="quote-actions-menu__trigger"
                  aria-label="Ouvrir les actions du devis"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuoteActionMenuId((current) => (current === quote.id ? null : quote.id));
                  }}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="quote-actions-menu__panel">
                    <button type="button" className="quote-actions-menu__item" onClick={() => previewPdf(quote)} disabled={previewLoading}>
                      {previewLoading ? "Ouverture..." : "Previsualiser PDF"}
                    </button>
                    <button type="button" className="quote-actions-menu__item" onClick={() => downloadPdf(quote)}>
                      Telecharger PDF
                    </button>
                    <button type="button" className="quote-actions-menu__item" onClick={() => sendQuote(quote)}>
                      Envoyer
                    </button>
                    {quote.converted_invoice_id ? (
                      <button type="button" className="quote-actions-menu__item" onClick={() => openConvertedInvoice(quote)}>
                        Voir facture
                      </button>
                    ) : (
                      <button type="button" className="quote-actions-menu__item" onClick={() => convertQuote(quote)}>
                        Convertir facture
                      </button>
                    )}
                    <button type="button" className="quote-actions-menu__item is-danger" onClick={() => removeQuote(quote)}>
                      Supprimer
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        }}
      />

      {drawerOpen ? (
        <div className="modal-backdrop" onClick={closeWizard}>
          <aside className="drawer-sheet drawer-sheet-wide quote-wizard-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header quote-wizard-header">
              <div>
                <p className="card-label">Assistant devis</p>
                <h3>{editingQuoteId ? "Modifier le devis" : "Creer un devis en 5 etapes"}</h3>
                <p>
                  Choisis le client, la prestation et le prix. L'assistant garde la meme logique metier, mais la
                  saisie devient beaucoup plus lisible.
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
                      <p>Recherche rapide, selection simple, ou creation d'un client express sans quitter le devis.</p>
                    </div>
                    <input
                      placeholder="Rechercher un client"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                    <SearchSelect
                      value={form.client_id}
                      onChange={(next) => setForm({ ...form, client_id: next })}
                      options={clientSelectOptions}
                      placeholder="Choisir un client"
                      searchPlaceholder="Rechercher un client"
                      emptyText="Aucun client trouve"
                    />
                    <div className="wizard-inline-actions">
                      <button type="button" className="secondary" onClick={() => setQuickClientOpen((open) => !open)}>
                        {quickClientOpen ? "Fermer le client rapide" : "+ Nouveau client rapide"}
                      </button>
                    </div>
                    {quickClientOpen ? (
                      <form className="form-panel quote-inline-form" onSubmit={submitQuickClient}>
                        <div className="form-grid-2">
                          <input
                            placeholder="Entreprise"
                            value={quickClientForm.company_name}
                            onChange={(e) => setQuickClientForm({ ...quickClientForm, company_name: e.target.value })}
                            required
                          />
                          <input
                            placeholder="Contact"
                            value={quickClientForm.contact_name}
                            onChange={(e) => setQuickClientForm({ ...quickClientForm, contact_name: e.target.value })}
                          />
                          <input
                            type="email"
                            placeholder="Email"
                            value={quickClientForm.email}
                            onChange={(e) => setQuickClientForm({ ...quickClientForm, email: e.target.value })}
                          />
                          <input
                            type="tel"
                            inputMode="tel"
                            placeholder="Telephone"
                            value={quickClientForm.phone}
                            onChange={(e) => setQuickClientForm({ ...quickClientForm, phone: e.target.value })}
                          />
                        </div>
                        <button type="submit" className="primary-action">
                          Ajouter ce client
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}

                {wizardStep === 1 ? (
                  <>
                    <p className="form-section-title">Etape 2 · Dossier rapide</p>
                    <div className="quote-wizard-copy">
                      <p>Devis sur mesure: renseigne seulement les informations utiles pour la mission, puis passe directement au prix.</p>
                    </div>
                    <div className="form-grid-2">
                      <input
                        type="date"
                        value={form.quote_date}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setForm((prev) => ({ ...prev, quote_date: value }));
                          await refreshNextNumber(value);
                        }}
                      />
                      <input
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                      />
                      <input
                        placeholder="Date intervention"
                        type="date"
                        value={context.service_date}
                        onChange={(e) => setContext((prev) => ({ ...prev, service_date: e.target.value }))}
                      />
                      <input
                        placeholder="Lieu"
                        value={context.service_location}
                        onChange={(e) => setContext((prev) => ({ ...prev, service_location: e.target.value }))}
                      />
                      <input
                        placeholder="Duree estimee"
                        value={context.estimated_duration}
                        onChange={(e) => setContext((prev) => ({ ...prev, estimated_duration: e.target.value }))}
                      />
                      <SegmentedControl value={form.status} onChange={(next) => setForm({ ...form, status: next })} options={QUOTE_STATUS_OPTIONS} />
                    </div>
                    <textarea
                      placeholder="Notes client ou contexte de la mission"
                      value={context.client_note}
                      onChange={(e) => setContext((prev) => ({ ...prev, client_note: e.target.value }))}
                    />
                    <textarea
                      placeholder="Notes internes ou remarques complementaires"
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </>
                ) : null}

                {wizardStep === 2 ? (
                  <>
                    <div className="page-head quote-pricing-head">
                      <h3>Etape 3 · Prix et prestations</h3>
                      <button type="button" className="secondary" onClick={addItem}>
                        + Ligne
                      </button>
                    </div>
                    <div className="quote-line-list">
                      {items.map((item, index) => (
                        <div key={index} className="quote-line-card">
                          <div className="quote-line-card__head">
                            <strong>Ligne {index + 1}</strong>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => removeItem(index)}
                              disabled={items.length === 1}
                            >
                              Retirer
                            </button>
                          </div>
                          <div className="quote-line-grid">
                            <input
                              list="quote-articles"
                              placeholder="Description"
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
                    <datalist id="quote-articles">
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
                        placeholder="Remise %"
                        value={form.discount_percent}
                        onChange={(e) => setForm((prev) => ({ ...prev, discount_percent: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Remise montant"
                        value={form.discount_amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Acompte %"
                        value={form.acompte_percent}
                        onChange={(e) => setForm((prev) => ({ ...prev, acompte_percent: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Acompte montant"
                        value={form.acompte_amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, acompte_amount: e.target.value }))}
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
                          {selectedClient?.contact_name || "Contact non renseigne"}{selectedClient?.email ? ` · ${selectedClient.email}` : ""}
                        </span>
                      </div>
                      <div className="quote-preview-section">
                        <span className="data-row-label">Perimetre</span>
                        <strong>Devis sur mesure</strong>
                        <span className="muted-copy">
                          {context.service_location || "Lieu a confirmer"}{context.service_date ? ` · ${context.service_date}` : ""}
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
                <p className="card-label">Resume du devis</p>
                <div className="quote-summary-stack">
                  <div className="quote-summary-row">
                    <span>Numero</span>
                    <strong>{form.quote_number || "-"}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Client</span>
                    <strong>{selectedClient?.company_name || "A selectionner"}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Sous-total</span>
                    <strong>{formatMoney(totals.subtotal, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Remise</span>
                    <strong>{formatMoney(totals.discount, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Total TTC</span>
                    <strong>{formatMoney(totals.total, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row">
                    <span>Acompte</span>
                    <strong>{formatMoney(totals.acompte, form.currency)}</strong>
                  </div>
                  <div className="quote-summary-row quote-summary-row-balance">
                    <span>Solde estime</span>
                    <strong>{formatMoney(totals.balance, form.currency)}</strong>
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
                    <button type="button" className="secondary" onClick={saveAndDownloadPdf} disabled={submitting}>
                      Generer PDF
                    </button>
                    <button type="button" className="primary-action" onClick={saveAndSendQuote} disabled={submitting}>
                      Envoyer au client
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {previewOpen ? (
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
      ) : null}
    </div>
  );
}
