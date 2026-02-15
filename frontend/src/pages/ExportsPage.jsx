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
    <div>
      <div className="page-head">
        <h2>Exports CSV</h2>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="card">
          <p className="card-label">Flotte</p>
          <p className="card-value" style={{ fontSize: "1rem" }}>Drones</p>
          <button onClick={() => exportEntity("drones")}>Exporter</button>
        </div>
        <div className="card">
          <p className="card-label">Opérations</p>
          <p className="card-value" style={{ fontSize: "1rem" }}>Missions</p>
          <button onClick={() => exportEntity("missions")}>Exporter</button>
        </div>
        <div className="card">
          <p className="card-label">Finance</p>
          <p className="card-value" style={{ fontSize: "1rem" }}>Factures</p>
          <button onClick={() => exportEntity("invoices")}>Exporter</button>
        </div>
        <div className="card">
          <p className="card-label">Finance</p>
          <p className="card-value" style={{ fontSize: "1rem" }}>Paiements</p>
          <button onClick={() => exportEntity("payments")}>Exporter</button>
        </div>
      </div>
    </div>
  );
}
