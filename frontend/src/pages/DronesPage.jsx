import { useEffect, useState } from "react";
import { api } from "../api";

export default function DronesPage() {
  const [drones, setDrones] = useState([]);
  const [form, setForm] = useState({ brand: "", model: "", serial_number: "" });
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
      setForm({ brand: "", model: "", serial_number: "" });
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
        <button>Ajouter</button>
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
