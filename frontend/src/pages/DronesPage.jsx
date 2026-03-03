import { useEffect, useState } from "react";
import { api } from "../api";

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

export default function DronesPage() {
  const [drones, setDrones] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDrone, setEditingDrone] = useState(null);
  const [editForm, setEditForm] = useState(defaultForm);
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

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.drones.create({
        ...form,
        purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
        battery_cycle_threshold: Number(form.battery_cycle_threshold || 300),
        propeller_hours_threshold: Number(form.propeller_hours_threshold || 120)
      });
      setForm(defaultForm);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function startEdit(drone) {
    setEditingDrone(drone);
    setEditForm({
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
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingDrone) return;
    setError("");
    try {
      await api.drones.update(editingDrone.id, {
        ...editForm,
        purchase_price: editForm.purchase_price === "" ? null : Number(editForm.purchase_price),
        battery_cycle_threshold: Number(editForm.battery_cycle_threshold || 300),
        propeller_hours_threshold: Number(editForm.propeller_hours_threshold || 120)
      });
      setEditOpen(false);
      setEditingDrone(null);
      await load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  function cancelEdit() {
    setEditOpen(false);
    setEditingDrone(null);
    setEditForm(defaultForm);
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

  return (
    <div>
      <div className="page-head">
        <h2>Drones</h2>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <input placeholder="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
        <input placeholder="Modele" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <input placeholder="Numero de serie" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="active">Actif</option>
          <option value="maintenance">Maintenance</option>
          <option value="grounded">Au sol</option>
          <option value="retired">Retire</option>
        </select>
        <input type="date" placeholder="Date achat" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
        <input type="number" min="0" step="0.01" placeholder="Prix achat" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
        <input type="date" placeholder="Derniere maintenance" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
        <input placeholder="Historique incidents" value={form.incident_history} onChange={(e) => setForm({ ...form, incident_history: e.target.value })} />
        <input type="number" min="0" step="1" placeholder="Seuil cycles batterie" value={form.battery_cycle_threshold} onChange={(e) => setForm({ ...form, battery_cycle_threshold: e.target.value })} />
        <input type="number" min="0" step="0.1" placeholder="Seuil heures helices" value={form.propeller_hours_threshold} onChange={(e) => setForm({ ...form, propeller_hours_threshold: e.target.value })} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button style={{ gridColumn: "1 / -1" }}>Ajouter</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Marque</th>
              <th>Modele</th>
              <th>S/N</th>
              <th>Etat</th>
              <th>Heures</th>
              <th>Cycles</th>
              <th>Seuils</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drones.map((d) => (
              <tr key={d.id}>
                <td data-label="Marque">{d.brand}</td>
                <td data-label="Modele">{d.model}</td>
                <td data-label="S/N">{d.serial_number}</td>
                <td data-label="Etat">{d.status}</td>
                <td data-label="Heures">{Number(d.total_flight_hours).toFixed(1)}</td>
                <td data-label="Cycles">{d.total_cycles}</td>
                <td data-label="Seuils">
                  {d.battery_cycle_threshold || 300} cyc / {Number(d.propeller_hours_threshold || 120).toFixed(1)} h
                </td>
                <td data-label="Actions" className="actions-cell">
                  <button type="button" className="secondary" onClick={() => startEdit(d)}>
                    ✏️ Modifier
                  </button>
                  <button type="button" className="secondary" onClick={() => removeDrone(d)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: "1.1rem" }}>Modifier le drone</h2>
            </div>
            <form className="form-grid" onSubmit={saveEdit}>
              <input placeholder="Marque" value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} required />
              <input placeholder="Modele" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} required />
              <input placeholder="Numero de serie" value={editForm.serial_number} onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })} required />
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="active">Actif</option>
                <option value="maintenance">Maintenance</option>
                <option value="grounded">Au sol</option>
                <option value="retired">Retire</option>
              </select>
              <input type="date" value={editForm.purchase_date} onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })} />
              <input type="number" min="0" step="0.01" placeholder="Prix achat" value={editForm.purchase_price} onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value })} />
              <input type="date" value={editForm.last_maintenance_date} onChange={(e) => setEditForm({ ...editForm, last_maintenance_date: e.target.value })} />
              <input placeholder="Historique incidents" value={editForm.incident_history} onChange={(e) => setEditForm({ ...editForm, incident_history: e.target.value })} />
              <input type="number" min="0" step="1" placeholder="Seuil cycles batterie" value={editForm.battery_cycle_threshold} onChange={(e) => setEditForm({ ...editForm, battery_cycle_threshold: e.target.value })} />
              <input type="number" min="0" step="0.1" placeholder="Seuil heures helices" value={editForm.propeller_hours_threshold} onChange={(e) => setEditForm({ ...editForm, propeller_hours_threshold: e.target.value })} />
              <input placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button type="submit">Enregistrer</button>
                <button type="button" className="secondary" onClick={cancelEdit}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
