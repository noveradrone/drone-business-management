import { useState } from "react";
import { api } from "../api";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORTS = [
  { key: "drones", title: "Drones", label: "Flotte", description: "Etat, cycles, temps de vol et maintenance.", icon: "◫" },
  { key: "missions", title: "Missions", label: "Operations", description: "Planning, rentabilite et historiques de vol.", icon: "✦" },
  { key: "invoices", title: "Factures", label: "Finance", description: "Export comptable des factures emises.", icon: "▣" },
  { key: "payments", title: "Paiements", label: "Finance", description: "Suivi des encaissements et soldes restants.", icon: "⇡" }
];

export default function ExportsPage() {
  const [error, setError] = useState("");

  async function exportEntity(entity) {
    setError("");
    try {
      const blob = await api.exports.csv(entity);
      download(blob, `${entity}.csv`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="exports-page">
      <div className="page-header">
        <div><p className="login-eyebrow">Data hub</p></div>
        <h2 className="page-title">Centre d’exports</h2>
        <div />
      </div>
      <p className="page-summary">Prépare rapidement les exports nécessaires pour la comptabilité, l’analyse ou les échanges avec tes outils externes.</p>

      {error && <p className="error">{error}</p>}

      <section className="export-hub-grid">
        {EXPORTS.map((entry) => (
          <article key={entry.key} className="export-tile">
            <div className="export-tile-top">
              <div>
                <p className="card-label">{entry.label}</p>
                <h3>{entry.title}</h3>
              </div>
              <span className="kpi-icon">{entry.icon}</span>
            </div>
            <p className="muted-copy" style={{ margin: 0 }}>{entry.description}</p>
            <div className="metrics-inline">
              <div className="metric-inline">
                <span className="muted-copy">Format</span>
                <strong>CSV</strong>
              </div>
              <div className="metric-inline">
                <span className="muted-copy">Dernier export</span>
                <strong>A la demande</strong>
              </div>
            </div>
            <button type="button" onClick={() => exportEntity(entry.key)}>Exporter {entry.title}</button>
          </article>
        ))}
      </section>
    </div>
  );
}
