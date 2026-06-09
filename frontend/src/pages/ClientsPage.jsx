import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

const EMPTY_FORM = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  billing_address: "",
  siret: "",
  vat_number: "",
  source_channel: "",
  is_prospect: 1
};

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "prospect", label: "Prospects" },
  { value: "client", label: "Clients" }
];

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingClientId, setEditingClientId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
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

  function openCreate() {
    setEditingClientId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function startEdit(client) {
    setError("");
    setEditingClientId(client.id);
    setForm({
      company_name: client.company_name || "",
      contact_name: client.contact_name || "",
      email: client.email || "",
      phone: client.phone || "",
      billing_address: client.billing_address || "",
      siret: client.siret || "",
      vat_number: client.vat_number || "",
      source_channel: client.source_channel || "",
      is_prospect: Number(client.is_prospect ?? 1)
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingClientId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingClientId) await api.clients.update(editingClientId, form);
      else await api.clients.create(form);
      closeDrawer();
      await load();
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

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      const haystack = `${client.company_name} ${client.contact_name} ${client.email} ${client.phone}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "prospect"
            ? Number(client.is_prospect) === 1
            : Number(client.is_prospect) === 0;
      return matchesQuery && matchesFilter;
    });
  }, [clients, query, filter]);

  return (
    <div className="clients-page">
      <div className="page-header">
        <div><p className="login-eyebrow">CRM</p></div>
        <h2 className="page-title">Relation client et prospection</h2>
        <div className="page-action"><button type="button" onClick={openCreate}>+ Nouveau client</button></div>
      </div>
      <p className="page-summary">Un CRM simple, rapide et opérationnel : accès immédiat au contact, au statut et aux actions utiles pour vendre plus vite.</p>

      {error && <p className="error">{error}</p>}

      <section className="card toolbar-card">
        <div>
          <p className="card-label">Vue commerciale</p>
          <h3 style={{ margin: "6px 0 0" }}>Recherche instantanée et segmentation rapide</h3>
        </div>
        <div className="inline-filters">
          <input placeholder="Rechercher un client" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </section>

      <DataRowList
        items={visibleClients}
        className="client-row-list"
        emptyMessage="Aucun client."
        renderTitle={(client) => client.company_name}
        renderSubtitle={(client) => client.contact_name || "Contact non renseigné"}
        renderDetails={(client) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Email</span>
              <span className="data-row-value">{client.email || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Téléphone</span>
              <span className="data-row-value">{client.phone || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">SIRET</span>
              <span className="data-row-value">{client.siret || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Source</span>
              <span className="data-row-value">{client.source_channel || "Direct"}</span>
            </div>
          </div>
        )}
        renderMeta={(client) => (
          <>
            <span className="status-badge">{Number(client.is_prospect) === 1 ? "Prospect" : "Client actif"}</span>
            {client.billing_address ? <span className="data-row-note">{client.billing_address}</span> : null}
          </>
        )}
        renderActions={(client) => (
          <>
            {client.phone ? <a className="action-link-btn secondary" href={`tel:${client.phone}`}>Appeler</a> : null}
            {client.email ? <a className="action-link-btn secondary" href={`mailto:${client.email}`}>Email</a> : null}
            <button type="button" className="secondary" onClick={() => startEdit(client)}>Modifier</button>
            <button type="button" className="secondary">Créer devis</button>
            <button type="button" className="secondary">Créer mission</button>
            <button type="button" className="danger" onClick={() => removeClient(client)}>Supprimer</button>
          </>
        )}
      />

      {drawerOpen ? (
        <div className="modal-backdrop" onClick={closeDrawer}>
          <aside className="drawer-sheet drawer-sheet-wide" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{editingClientId ? "Modifier le client" : "Nouveau client"}</h3>
                <p>Renseigne uniquement l’essentiel. Le reste pourra être enrichi plus tard.</p>
              </div>
              <button type="button" className="btn btn-ghost drawer-close" onClick={closeDrawer}>✕</button>
            </div>

            <form className="form-panel" onSubmit={submit}>
              <div className="form-section">
                <p className="form-section-title">Identite</p>
                <div className="form-grid-2">
                  <input placeholder="Entreprise" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
                  <input placeholder="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input type="tel" inputMode="tel" placeholder="Telephone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="form-section">
                <p className="form-section-title">Administratif</p>
                <div className="form-grid-2">
                  <input placeholder="Adresse de facturation" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
                  <input placeholder="SIRET" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
                  <input placeholder="TVA" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
                  <input placeholder="Source lead" value={form.source_channel} onChange={(e) => setForm({ ...form, source_channel: e.target.value })} />
                  <select
                    className="form-span-2"
                    value={String(form.is_prospect)}
                    onChange={(e) => setForm({ ...form, is_prospect: Number(e.target.value) })}
                  >
                    <option value="1">Prospect</option>
                    <option value="0">Client actif</option>
                  </select>
                </div>
              </div>

              <div className="toolbar-actions">
                <button type="submit">{editingClientId ? "Enregistrer les modifications" : "Creer le client"}</button>
                <button type="button" className="secondary" onClick={closeDrawer}>Annuler</button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
