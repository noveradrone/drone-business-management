import { useEffect, useState } from "react";
import { api } from "../api";

const packOptions = ["Essentiel", "Premium", "Instagram"];
const statusOptions = ["planned", "in_progress", "completed", "cancelled"];

export default function MissionsPage() {
  const [missions, setMissions] = useState([]);
  const [clients, setClients] = useState([]);
  const [drones, setDrones] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    drone_id: "",
    client_id: "",
    mission_date: new Date().toISOString().slice(0, 10),
    location: "",
    duration_minutes: 30,
    flight_hours_logged: 0.5,
    cycles_logged: 1,
    preparation_hours: 0.5,
    flight_time_hours: 0.5,
    montage_hours: 0.5,
    mileage_km: 0,
    variable_costs: 0,
    department: "",
    selected_pack: "Essentiel",
    mission_status: "planned",
    photo_url: "",
    notes: ""
  });

  async function load() {
    try {
      const [missionsRows, clientsRows, dronesRows] = await Promise.all([
        api.missions.list(),
        api.clients.list(),
        api.drones.list()
      ]);
      setMissions(missionsRows);
      setClients(clientsRows);
      setDrones(dronesRows);
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
    setSubmitting(true);
    try {
      await api.missions.create({
        ...form,
        drone_id: Number(form.drone_id),
        client_id: Number(form.client_id),
        duration_minutes: Number(form.duration_minutes),
        flight_hours_logged: Number(form.flight_hours_logged),
        cycles_logged: Number(form.cycles_logged),
        preparation_hours: Number(form.preparation_hours),
        flight_time_hours: Number(form.flight_time_hours),
        montage_hours: Number(form.montage_hours),
        mileage_km: Number(form.mileage_km),
        variable_costs: Number(form.variable_costs),
        photo_url: form.photo_url || null,
        notes: form.notes || null
      });
      setForm({
        drone_id: "",
        client_id: "",
        mission_date: new Date().toISOString().slice(0, 10),
        location: "",
        duration_minutes: 30,
        flight_hours_logged: 0.5,
        cycles_logged: 1,
        preparation_hours: 0.5,
        flight_time_hours: 0.5,
        montage_hours: 0.5,
        mileage_km: 0,
        variable_costs: 0,
        department: "",
        selected_pack: "Essentiel",
        mission_status: "planned",
        photo_url: "",
        notes: ""
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMission(mission) {
    if (!window.confirm(`Supprimer la mission du ${mission.mission_date} ?`)) return;
    setError("");
    try {
      await api.missions.remove(mission.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="missions-page">
      <div className="page-head">
        <h2>Missions</h2>
        <span className="pill">ERP evenementiel</span>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select value={form.drone_id} onChange={(e) => setForm({ ...form, drone_id: e.target.value })} required>
          <option value="">Drone</option>
          {drones.map((d) => (
            <option key={d.id} value={d.id}>
              {d.brand} {d.model} ({d.serial_number})
            </option>
          ))}
        </select>
        <input type="date" value={form.mission_date} onChange={(e) => setForm({ ...form, mission_date: e.target.value })} required />
        <input placeholder="Lieu" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
        <input type="number" min="1" placeholder="Duree (min)" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required />
        <input type="number" min="0" step="0.1" placeholder="Heures log" value={form.flight_hours_logged} onChange={(e) => setForm({ ...form, flight_hours_logged: e.target.value })} required />
        <input type="number" min="0" step="1" placeholder="Cycles" value={form.cycles_logged} onChange={(e) => setForm({ ...form, cycles_logged: e.target.value })} required />
        <input type="number" min="0" step="0.1" placeholder="Temps preparation (h)" value={form.preparation_hours} onChange={(e) => setForm({ ...form, preparation_hours: e.target.value })} />
        <input type="number" min="0" step="0.1" placeholder="Temps vol (h)" value={form.flight_time_hours} onChange={(e) => setForm({ ...form, flight_time_hours: e.target.value })} />
        <input type="number" min="0" step="0.1" placeholder="Temps montage (h)" value={form.montage_hours} onChange={(e) => setForm({ ...form, montage_hours: e.target.value })} />
        <input type="number" min="0" step="0.1" placeholder="Kilometrage" value={form.mileage_km} onChange={(e) => setForm({ ...form, mileage_km: e.target.value })} />
        <input type="number" min="0" step="0.01" placeholder="Couts variables" value={form.variable_costs} onChange={(e) => setForm({ ...form, variable_costs: e.target.value })} />
        <input placeholder="Departement" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <select value={form.selected_pack} onChange={(e) => setForm({ ...form, selected_pack: e.target.value })}>
          {packOptions.map((pack) => (
            <option key={pack} value={pack}>
              {pack}
            </option>
          ))}
        </select>
        <select value={form.mission_status} onChange={(e) => setForm({ ...form, mission_status: e.target.value })}>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input placeholder="URL photo (optionnel)" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
        <input placeholder="Notes (optionnel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="primary-action" style={{ gridColumn: "1 / -1" }} disabled={submitting}>
          {submitting ? "Creation..." : "Creer la mission"}
        </button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Pack</th>
              <th>Dep.</th>
              <th>Statut</th>
              <th>CA</th>
              <th>Cout total</th>
              <th>Marge brute</th>
              <th>Taux horaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id}>
                <td>{m.mission_date}</td>
                <td>{m.company_name}</td>
                <td>{m.selected_pack || "-"}</td>
                <td>{m.department || "-"}</td>
                <td>{m.mission_status}</td>
                <td>{Number(m.mission_revenue || 0).toFixed(2)} EUR</td>
                <td>{Number(m.total_cost || 0).toFixed(2)} EUR</td>
                <td>{Number(m.gross_margin || 0).toFixed(2)} EUR</td>
                <td>{Number(m.effective_hourly_rate || 0).toFixed(2)} EUR/h</td>
                <td>
                  <button type="button" className="secondary" onClick={() => removeMission(m)}>
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
