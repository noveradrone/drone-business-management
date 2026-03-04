import { useEffect, useState } from "react";
import { api } from "../api";

export default function ForecastPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.forecast
      .summary()
      .then((data) => setSummary(data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!summary) return <p>Chargement...</p>;

  return (
    <div>
      <div className="page-head">
        <h2>Previsionnel</h2>
      </div>

      <div className="card-grid">
        <div className="card">
          <p className="card-label">Revenus estimes (3 mois)</p>
          <p className="card-value">{Number(summary.estimated_revenue_3_months || 0).toFixed(2)} EUR</p>
        </div>
        <div className="card">
          <p className="card-label">Missions probables</p>
          <p className="card-value">{summary.probable_missions || 0}</p>
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Mois</th>
              <th>Revenus historiques</th>
            </tr>
          </thead>
          <tbody>
            {(summary.historical_revenue || []).map((item) => (
              <tr key={item.month}>
                <td data-label="Mois">{item.month}</td>
                <td data-label="Revenus historiques">{Number(item.revenue || 0).toFixed(2)} EUR</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Mois (saisonnalite)</th>
              <th>Nb missions</th>
            </tr>
          </thead>
          <tbody>
            {(summary.seasonality || []).map((item) => (
              <tr key={item.month}>
                <td data-label="Mois (saisonnalite)">{item.month}</td>
                <td data-label="Nb missions">{item.missions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Departement</th>
              <th>Missions</th>
            </tr>
          </thead>
          <tbody>
            {(summary.missions_by_department || []).map((item) => (
              <tr key={item.department}>
                <td data-label="Departement">{item.department}</td>
                <td data-label="Missions">{item.missions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
