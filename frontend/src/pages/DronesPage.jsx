import { useEffect, useState } from "react";
import { api } from "../api";

export default function DronesPage() {
  const [drones, setDrones] = useState([]);
  const [form, setForm] = useState({
    brand: "",
    model: "",
    serial_number: "",
    last_maintenance_date: "",
    incident_history: "",
    battery_cycle_threshold: 300,
    propeller_hours_threshold: 120
  });
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
      await api.drones.create(form);
      setForm({
        brand: "",
        model: "",
        serial_number: "",
        last_maintenance_date: "",
        incident_history: "",
        battery_cycle_threshold: 300,
        propeller_hours_threshold: 120
      });
      load();
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

  return (
    <div>
      <div className="page-head">
        <h2>Drones</h2>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <input placeholder="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
        <input placeholder="Modèle" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <input placeholder="Numéro de série" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
        <input type="date" placeholder="Derniere maintenance" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
        <input placeholder="Historique incidents" value={form.incident_history} onChange={(e) => setForm({ ...form, incident_history: e.target.value })} />
        <input type="number" min="0" step="1" placeholder="Seuil cycles batterie" value={form.battery_cycle_threshold} onChange={(e) => setForm({ ...form, battery_cycle_threshold: e.target.value })} />
        <input type="number" min="0" step="0.1" placeholder="Seuil heures helices" value={form.propeller_hours_threshold} onChange={(e) => setForm({ ...form, propeller_hours_threshold: e.target.value })} />
        <button style={{ gridColumn: "1 / -1" }}>Ajouter</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marque</th>
              <th>Modèle</th>
              <th>S/N</th>
              <th>État</th>
              <th>Heures</th>
              <th>Cycles</th>
              <th>Seuils</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drones.map((d) => (
              <tr key={d.id}>
                <td>{d.brand}</td>
                <td>{d.model}</td>
                <td>{d.serial_number}</td>
                <td>{d.status}</td>
                <td>{Number(d.total_flight_hours).toFixed(1)}</td>
                <td>{d.total_cycles}</td>
                <td>
                  {d.battery_cycle_threshold || 300} cyc / {Number(d.propeller_hours_threshold || 120).toFixed(1)} h
                </td>
                <td>
                  <button type="button" className="secondary" onClick={() => removeDrone(d)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
