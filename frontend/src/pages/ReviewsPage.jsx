import { useEffect, useState } from "react";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

export default function ReviewsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setRows(await api.reviews.eligible());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshList() {
    setError("");
    setLoading(true);
    try {
      await api.reviews.refresh();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendReviewRequest(row) {
    setError("");
    try {
      await api.reviews.send(row.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Demandes d'avis Google</h2>
        <button className="secondary" onClick={refreshList} disabled={loading}>
          {loading ? "Mise a jour..." : "Relance avis Google"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <DataRowList
        items={rows}
        emptyMessage="Aucun client a relancer actuellement."
        renderTitle={(r) => r.contact_name || r.company_name}
        renderDetails={(r) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Telephone</span>
              <span className="data-row-value">{r.phone || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Mission</span>
              <span className="data-row-value">{r.mission_date}</span>
            </div>
          </div>
        )}
        renderMeta={(r) => <span className="data-row-chip">Relances: {r.compteur_relances}</span>}
        renderActions={(r) => (
          <button className="secondary" onClick={() => sendReviewRequest(r)}>
            Envoyer demande d'avis
          </button>
        )}
      />
    </div>
  );
}
