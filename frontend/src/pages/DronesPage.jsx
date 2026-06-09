import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import CustomSelect from "../components/CustomSelect";
import DataRowList from "../components/DataRowList";

const defaultForm = {
  brand: "",
  model: "",
  serial_number: "",
  status: "active",
  purchase_date: "",
  purchase_price: "",
  notes: "",
  last_maintenance_date: "",
  incident_history: "",
  battery_cycle_threshold: 300,
  propeller_hours_threshold: 120
};

const STATUS_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actif" },
  { value: "maintenance", label: "Maintenance" },
  { value: "grounded", label: "Au sol" },
  { value: "retired", label: "Hors service" }
];

function scoreHealth(drone) {
  const cycleThreshold = Number(drone.battery_cycle_threshold || 300);
  const propThreshold = Number(drone.propeller_hours_threshold || 120);
  const cycleRatio = cycleThreshold ? Number(drone.total_cycles || 0) / cycleThreshold : 0;
  const hourRatio = propThreshold ? Number(drone.total_flight_hours || 0) / propThreshold : 0;
  const usage = Math.max(cycleRatio, hourRatio);
  return Math.max(8, Math.min(100, Math.round((1 - usage) * 100)));
}

function statusLabel(value) {
  return {
    active: "Actif",
    maintenance: "Maintenance",
    grounded: "Au sol",
    retired: "Hors service"
  }[value] || value;
}

export default function DronesPage() {
  const [drones, setDrones] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDrone, setEditingDrone] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [error, setError] = useState("");

  async function load() {
    try {
      setDrones(await api.drones.list());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingDrone(null);
    setForm(defaultForm);
    setDrawerOpen(true);
  }

  function openEdit(drone) {
    setEditingDrone(drone);
    setForm({
      brand: drone.brand || "",
      model: drone.model || "",
      serial_number: drone.serial_number || "",
      status: drone.status || "active",
      purchase_date: drone.purchase_date || "",
      purchase_price: drone.purchase_price ?? "",
      notes: drone.notes || "",
      last_maintenance_date: drone.last_maintenance_date || "",
      incident_history: drone.incident_history || "",
      battery_cycle_threshold: drone.battery_cycle_threshold ?? 300,
      propeller_hours_threshold: drone.propeller_hours_threshold ?? 120
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingDrone(null);
    setForm(defaultForm);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
      battery_cycle_threshold: Number(form.battery_cycle_threshold || 300),
      propeller_hours_threshold: Number(form.propeller_hours_threshold || 120)
    };
    try {
      if (editingDrone) await api.drones.update(editingDrone.id, payload);
      else await api.drones.create(payload);
      closeDrawer();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeDrone(drone) {
    if (!window.confirm(`Supprimer le drone ${drone.serial_number} ?`)) return;
    setError("");
    try {
      await api.drones.remove(drone.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const visibleDrones = useMemo(() => {
    const rows = drones.filter((drone) => {
      const haystack = `${drone.brand} ${drone.model} ${drone.serial_number}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : drone.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    rows.sort((a, b) => {
      if (sortBy === "flight") return Number(b.total_flight_hours || 0) - Number(a.total_flight_hours || 0);
      if (sortBy === "status") return String(a.status || "").localeCompare(String(b.status || ""), "fr");
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "fr");
    });

    return rows;
  }, [drones, query, statusFilter, sortBy]);

  return (
    <div className="drones-page">
      <div className="page-header">
        <div>
          <p className="login-eyebrow">Flotte</p>
        </div>
        <h2 className="page-title">Gestion de flotte drone</h2>
        <div className="page-action">
          <button className="btn" type="button" onClick={openCreate}>+ Nouveau drone</button>
        </div>
      </div>
      <p className="page-summary">Une vue claire sur l’état de chaque appareil, son usure, sa maintenance et sa disponibilité opérationnelle.</p>

      {error && <p className="error">{error}</p>}

      <section className="card toolbar-card">
        <div>
          <p className="card-label">Pilotage rapide</p>
          <h3 style={{ margin: "6px 0 0" }}>Recherche, filtres et tri en temps réel</h3>
        </div>
        <div className="inline-filters">
          <input placeholder="Rechercher un drone" value={query} onChange={(e) => setQuery(e.target.value)} />
          <CustomSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "name", label: "Tri : Nom" },
              { value: "flight", label: "Tri : Temps de vol" },
              { value: "status", label: "Tri : Etat" }
            ]}
          />
        </div>
      </section>

      <DataRowList
        items={visibleDrones}
        className="drone-row-list"
        emptyMessage="Aucun drone."
        renderTitle={(drone) => `${drone.brand} ${drone.model}`}
        renderSubtitle={(drone) => `S/N ${drone.serial_number}`}
        renderDetails={(drone) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">État</span>
              <span className="data-row-value">{statusLabel(drone.status)}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Temps de vol</span>
              <span className="data-row-value">{Number(drone.total_flight_hours || 0).toFixed(1)} h</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Cycles</span>
              <span className="data-row-value">{Number(drone.total_cycles || 0)}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Maintenance</span>
              <span className="data-row-value">{drone.last_maintenance_date || "À définir"}</span>
            </div>
          </div>
        )}
        renderMeta={(drone) => {
          const health = scoreHealth(drone);
          return (
            <>
              <span className="status-badge">{health}% santé</span>
              <div className="data-row-progress">
                <div className="health-bar"><span style={{ width: `${health}%` }} /></div>
                <span className="data-row-note">
                  {drone.notes || "Aucune note de maintenance renseignée."}
                </span>
              </div>
            </>
          );
        }}
        renderActions={(drone) => (
          <>
            <button type="button" className="secondary" onClick={() => openEdit(drone)}>Modifier</button>
            <button type="button" className="secondary">Historique</button>
            <button type="button" className="secondary">Maintenance</button>
            <button type="button" className="danger" onClick={() => removeDrone(drone)}>Supprimer</button>
          </>
        )}
      />

      {drawerOpen ? (
        <div className="modal-backdrop" onClick={closeDrawer}>
          <aside className="drawer-sheet drawer-sheet-wide" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{editingDrone ? "Modifier le drone" : "Nouveau drone"}</h3>
                <p>Crée ou mets à jour un appareil sans quitter la vue flotte.</p>
              </div>
              <button type="button" className="btn btn-ghost drawer-close" onClick={closeDrawer}>✕</button>
            </div>

            <form className="form-panel" onSubmit={submit}>
              <div className="form-section">
                <p className="form-section-title">Identité appareil</p>
                <div className="form-grid-2">
                  <input placeholder="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
                  <input placeholder="Modele" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                  <input placeholder="Numero de serie" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
                  <CustomSelect
                    value={form.status}
                    onChange={(next) => setForm({ ...form, status: next })}
                    options={STATUS_OPTIONS.filter((option) => option.value !== "all")}
                  />
                </div>
              </div>

              <div className="form-section">
                <p className="form-section-title">Cycle de vie et maintenance</p>
                <div className="form-grid-2">
                  <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                  <input type="number" min="0" step="0.01" placeholder="Prix achat" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
                  <input type="date" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
                  <input placeholder="Historique incidents" value={form.incident_history} onChange={(e) => setForm({ ...form, incident_history: e.target.value })} />
                  <input type="number" min="0" step="1" placeholder="Seuil cycles batterie" value={form.battery_cycle_threshold} onChange={(e) => setForm({ ...form, battery_cycle_threshold: e.target.value })} />
                  <input type="number" min="0" step="0.1" placeholder="Seuil heures helices" value={form.propeller_hours_threshold} onChange={(e) => setForm({ ...form, propeller_hours_threshold: e.target.value })} />
                </div>
              </div>

              <div className="form-section">
                <p className="form-section-title">Notes</p>
                <textarea placeholder="Commentaire interne, état, configuration, remarques atelier..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="toolbar-actions">
                <button type="submit">{editingDrone ? "Enregistrer" : "Creer le drone"}</button>
                <button type="button" className="secondary" onClick={closeDrawer}>Annuler</button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
