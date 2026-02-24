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

  const { kpis, topDrones, cashflow, mostProfitableMission, maintenanceAlerts = [] } = summary;

  return (
    <div className="dashboard-page">
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

      <div className="card-grid">
        <div className="card">
          <p className="card-label">Panier moyen</p>
          <p className="card-value">{Number(kpis.averageBasket || 0).toFixed(2)} €</p>
        </div>
        <div className="card">
          <p className="card-label">CA mois en cours</p>
          <p className="card-value">{Number(kpis.revenueCurrentMonth || 0).toFixed(2)} €</p>
        </div>
        <div className="card">
          <p className="card-label">CA 12 mois glissants</p>
          <p className="card-value">{Number(kpis.revenueLast12Months || 0).toFixed(2)} €</p>
        </div>
        <div className="card">
          <p className="card-label">Objectif mensuel atteint</p>
          <p className="card-value">
            {Number(kpis.targetProgressPercent || 0).toFixed(1)}% ({Number(kpis.monthlyTarget || 0).toFixed(0)}€)
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Mission la plus rentable</h3>
        {!mostProfitableMission ? (
          <p style={{ margin: 0 }}>Aucune mission rentable disponible.</p>
        ) : (
          <p style={{ margin: 0 }}>
            {mostProfitableMission.company_name} ({mostProfitableMission.mission_date}) - Marge:{" "}
            {Number(mostProfitableMission.gross_margin || 0).toFixed(2)} €
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Top drones (heures de vol)</h3>
        <div className="table-wrap">
          <table className="mobile-cards-table">
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
                  <td data-label="Drone">{d.brand} {d.model}</td>
                  <td data-label="S/N">{d.serial_number}</td>
                  <td data-label="Heures">{Number(d.total_flight_hours).toFixed(1)}</td>
                  <td data-label="Cycles">{d.total_cycles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Encaissements mensuels</h3>
        <div className="table-wrap">
          <table className="mobile-cards-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Collecté</th>
              </tr>
            </thead>
            <tbody>
              {cashflow.map((c) => (
                <tr key={c.month}>
                  <td data-label="Mois">{c.month}</td>
                  <td data-label="Collecte">{Number(c.collected).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Alertes maintenance</h3>
        {maintenanceAlerts.length === 0 ? (
          <p style={{ margin: 0 }}>Aucune alerte maintenance.</p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="mobile-cards-table">
              <thead>
                <tr>
                  <th>Drone</th>
                  <th>Cycles</th>
                  <th>Seuil cycles</th>
                  <th>Heures</th>
                  <th>Seuil helice</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceAlerts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Drone">
                      {a.brand} {a.model} ({a.serial_number})
                    </td>
                    <td data-label="Cycles">{a.total_cycles}</td>
                    <td data-label="Seuil cycles">{a.battery_cycle_threshold}</td>
                    <td data-label="Heures">{Number(a.total_flight_hours || 0).toFixed(1)}</td>
                    <td data-label="Seuil helice">{Number(a.propeller_hours_threshold || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Rappels</h3>
        {reminders.length === 0 ? (
          <p style={{ margin: 0 }}>Aucun rappel en attente.</p>
        ) : (
          <div className="table-wrap">
            <table className="mobile-cards-table">
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
                    <td data-label="Type">{r.reminder_type}</td>
                    <td data-label="Echeance">{r.due_date}</td>
                    <td data-label="Message">{r.message}</td>
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
