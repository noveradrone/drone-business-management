import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import DataTable from "../components/DataTable";

function currency(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function chartBars(rows = [], key = "collected") {
  const max = Math.max(...rows.map((row) => Number(row[key] || 0)), 1);
  return rows.map((row) => ({
    ...row,
    height: Math.max(12, Math.round((Number(row[key] || 0) / max) * 100))
  }));
}

export default function DashboardPage() {
  const navigate = useNavigate();
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

  const cashflowBars = useMemo(() => chartBars(summary?.cashflow || []), [summary]);
  const droneBars = useMemo(() => chartBars(summary?.topDrones || [], "total_flight_hours"), [summary]);

  if (error) return <p className="error">{error}</p>;
  if (!summary) return <div className="loading">Chargement du dashboard...</div>;

  const { kpis = {}, topDrones = [], cashflow = [], mostProfitableMission, maintenanceAlerts = [] } = summary;
  const activityFeed = [
    mostProfitableMission
      ? {
          label: "Mission rentable détectée",
          text: `${mostProfitableMission.company_name} · ${currency(mostProfitableMission.gross_margin)}`
        }
      : null,
    reminders[0]
      ? {
          label: "Rappel actif",
          text: reminders[0].message
        }
      : null,
    topDrones[0]
      ? {
          label: "Drone le plus sollicité",
          text: `${topDrones[0].brand} ${topDrones[0].model} · ${Number(topDrones[0].total_flight_hours || 0).toFixed(1)} h`
        }
      : null,
    {
      label: "Objectif mensuel",
      text: `${percent(kpis.targetProgressPercent)} de ${currency(kpis.monthlyTarget)}`
    }
  ].filter(Boolean);

  const alertRows = maintenanceAlerts.slice(0, 4).map((row) => {
    const overCycles = Number(row.total_cycles || 0) >= Number(row.battery_cycle_threshold || 0);
    const overHours = Number(row.total_flight_hours || 0) >= Number(row.propeller_hours_threshold || 0);
    const level = overCycles && overHours ? "Critique" : overCycles || overHours ? "Attention" : "OK";
    return { ...row, level };
  });

  return (
    <div className="dashboard-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="login-eyebrow">Cockpit opérationnel</p>
          <h2>Une vue d’ensemble claire sur ta flotte, ta finance et tes priorités terrain.</h2>
          <p>
            Le dashboard centralise ce qui compte aujourd’hui : chiffre d’affaires, encaissements,
            charge mission et alertes de maintenance. L’objectif est d’aller plus vite, sans chercher l’info.
          </p>
        </div>
        <div className="card stack">
          <div>
            <p className="card-label">Objectif du mois</p>
            <p className="card-value">{percent(kpis.targetProgressPercent)}</p>
          </div>
          <div className="health-bar"><span style={{ width: `${Math.min(100, Number(kpis.targetProgressPercent || 0))}%` }} /></div>
          <div className="metrics-inline">
            <div className="metric-inline">
              <span className="muted-copy">CA mois</span>
              <strong>{currency(kpis.revenueCurrentMonth)}</strong>
            </div>
            <div className="metric-inline">
              <span className="muted-copy">Panier moyen</span>
              <strong>{currency(kpis.averageBasket)}</strong>
            </div>
          </div>
          <button className="btn" type="button" onClick={() => navigate("/invoices")}>Créer une facture</button>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="card kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">€</span>
            <span className="kpi-trend">+{percent(12.4)}</span>
          </div>
          <p className="card-label">CA total 12 mois</p>
          <p className="card-value">{currency(kpis.revenueLast12Months)}</p>
        </article>
        <article className="card kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">⇡</span>
            <span className="kpi-trend">+{percent(6.8)}</span>
          </div>
          <p className="card-label">Encaissements</p>
          <p className="card-value">{currency(kpis.receivable)}</p>
        </article>
        <article className="card kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">✦</span>
            <span className="kpi-trend">{Number(kpis.missions || 0)} actives</span>
          </div>
          <p className="card-label">Missions actives</p>
          <p className="card-value">{Number(kpis.missions || 0)}</p>
        </article>
        <article className="card kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">!</span>
            <span className="kpi-trend" style={{ color: "var(--danger)" }}>{Number(kpis.overdueInvoices || 0)} alertes</span>
          </div>
          <p className="card-label">Factures en retard</p>
          <p className="card-value">{Number(kpis.overdueInvoices || 0)}</p>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card chart-card">
          <div className="page-head">
            <h3>Chiffre d’affaires</h3>
          </div>
          <div className="bar-chart">
            {cashflowBars.length ? cashflowBars.map((row) => (
              <div key={row.month} className="bar-column">
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${row.height}%` }} />
                </div>
                <strong className="bar-value">{currency(row.collected)}</strong>
                <span className="bar-label">{row.month}</span>
              </div>
            )) : <p className="muted-copy">Aucune donnée d’encaissement.</p>}
          </div>
        </article>

        <article className="card chart-card">
          <div className="page-head">
            <h3>Activité missions</h3>
          </div>
          <div className="bar-chart">
            {droneBars.length ? droneBars.map((row) => (
              <div key={row.id} className="bar-column">
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${row.height}%` }} />
                </div>
                <strong className="bar-value">{Number(row.total_flight_hours || 0).toFixed(1)} h</strong>
                <span className="bar-label">{row.model}</span>
              </div>
            )) : <p className="muted-copy">Aucune activité drone remontée.</p>}
          </div>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card">
          <div className="page-head"><h3>Activité récente</h3></div>
          <div className="activity-list">
            {activityFeed.map((item) => (
              <div key={`${item.label}-${item.text}`} className="activity-item">
                <span className="activity-dot" />
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted-copy" style={{ margin: "4px 0 0" }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="page-head"><h3>Alertes maintenance</h3></div>
          <div className="alert-list">
            {alertRows.length ? alertRows.map((item) => (
              <div key={item.id} className="alert-item">
                <span className={`alert-dot ${item.level === "Critique" ? "danger" : item.level === "Attention" ? "warning" : "success"}`} />
                <div>
                  <strong>{item.brand} {item.model}</strong>
                  <p className="muted-copy" style={{ margin: "4px 0 0" }}>
                    {item.level} · {item.total_cycles} cycles · {Number(item.total_flight_hours || 0).toFixed(1)} h
                  </p>
                </div>
              </div>
            )) : <p className="muted-copy">Aucune alerte de maintenance active.</p>}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="page-head"><h3>Rappels et suivi</h3></div>
        {reminders.length === 0 ? (
          <p className="muted-copy">Aucun rappel en attente.</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Type</th>
                <th>Echeance</th>
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
          </DataTable>
        )}
      </section>
    </div>
  );
}
