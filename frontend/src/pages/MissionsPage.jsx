import { useEffect, useState } from "react";
import { api } from "../api";

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
    <div>
      <div className="page-head">
        <h2>Missions</h2>
        <span className="pill">Création dans l'interface</span>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <select
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          required
        >
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select
          value={form.drone_id}
          onChange={(e) => setForm({ ...form, drone_id: e.target.value })}
          required
        >
          <option value="">Drone</option>
          {drones.map((d) => (
            <option key={d.id} value={d.id}>
              {d.brand} {d.model} ({d.serial_number})
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.mission_date}
          onChange={(e) => setForm({ ...form, mission_date: e.target.value })}
          required
        />
        <input
          placeholder="Lieu"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          required
        />
        <input
          type="number"
          min="1"
          placeholder="Durée (min)"
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
          required
        />
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Heures de vol"
          value={form.flight_hours_logged}
          onChange={(e) => setForm({ ...form, flight_hours_logged: e.target.value })}
          required
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Cycles"
          value={form.cycles_logged}
          onChange={(e) => setForm({ ...form, cycles_logged: e.target.value })}
          required
        />
        <input
          placeholder="URL photo (optionnel)"
          value={form.photo_url}
          onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
        />
        <input
          placeholder="Notes (optionnel)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button style={{ gridColumn: "1 / -1" }} disabled={submitting}>
          {submitting ? "Création..." : "Créer la mission"}
        </button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Drone</th>
              <th>Lieu</th>
              <th>Durée</th>
              <th>Heures log</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id}>
                <td>{m.mission_date}</td>
                <td>{m.company_name}</td>
                <td>{m.brand} {m.model}</td>
                <td>{m.location}</td>
                <td>{m.duration_minutes} min</td>
                <td>{Number(m.flight_hours_logged || 0).toFixed(1)}</td>
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
