import { useEffect, useState } from "react";
import { api } from "../api";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.dashboard.summary(), api.dashboard.reminders()])
      .then(([sum, rem]) => {
        setSummary(sum);
        setReminders(rem);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!summary) return <p>Chargement...</p>;

  const { kpis, topDrones, cashflow } = summary;

  return (
    <div>
      <div className="page-head">
        <h2>Dashboard</h2>
      </div>

      <div className="card-grid">
        <div className="card">
          <p className="card-label">Drones</p>
          <p className="card-value">{kpis.drones}</p>
        </div>
        <div className="card">
          <p className="card-label">Missions</p>
          <p className="card-value">{kpis.missions}</p>
        </div>
        <div className="card">
          <p className="card-label">Factures ouvertes</p>
          <p className="card-value">{kpis.invoicesOpen}</p>
        </div>
        <div className="card">
          <p className="card-label">A recevoir</p>
          <p className="card-value">{Number(kpis.receivable || 0).toFixed(2)} €</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Top drones (heures de vol)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Drone</th>
                <th>S/N</th>
                <th>Heures</th>
                <th>Cycles</th>
              </tr>
            </thead>
            <tbody>
              {topDrones.map((d) => (
                <tr key={d.id}>
                  <td>{d.brand} {d.model}</td>
                  <td>{d.serial_number}</td>
                  <td>{Number(d.total_flight_hours).toFixed(1)}</td>
                  <td>{d.total_cycles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Encaissements mensuels</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mois</th>
                <th>Collecté</th>
              </tr>
            </thead>
            <tbody>
              {cashflow.map((c) => (
                <tr key={c.month}>
                  <td>{c.month}</td>
                  <td>{Number(c.collected).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Rappels</h3>
        {reminders.length === 0 ? (
          <p style={{ margin: 0 }}>Aucun rappel en attente.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Échéance</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reminder_type}</td>
                    <td>{r.due_date}</td>
                    <td>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
