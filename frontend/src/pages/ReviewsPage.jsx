import { useEffect, useState } from "react";
import { api } from "../api";

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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Telephone</th>
              <th>Date mission</th>
              <th>Compteur relances</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.contact_name || r.company_name}</td>
                <td>{r.phone || "-"}</td>
                <td>{r.mission_date}</td>
                <td>{r.compteur_relances}</td>
                <td>
                  <button className="secondary" onClick={() => sendReviewRequest(r)}>
                    Envoyer demande d'avis
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="5">Aucun client a relancer actuellement.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
