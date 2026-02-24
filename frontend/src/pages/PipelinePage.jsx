import { useEffect, useState } from "react";
import { api } from "../api";

const statuses = [
  { value: "prospect", label: "Prospect" },
  { value: "quote_sent", label: "Devis envoye" },
  { value: "followup_1", label: "Relance 1" },
  { value: "followup_2", label: "Relance 2" },
  { value: "accepted", label: "Accepte" },
  { value: "lost", label: "Perdu" }
];

export default function PipelinePage() {
  const [clients, setClients] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    client_id: "",
    status: "prospect",
    source: "",
    notes: ""
  });

  async function load() {
    try {
      const [clientRows, pipelineRows, statsRows] = await Promise.all([
        api.clients.list(),
        api.pipeline.list(),
        api.pipeline.stats()
      ]);
      setClients(clientRows);
      setPipeline(pipelineRows);
      setStats(statsRows);
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
    try {
      await api.pipeline.upsert({
        ...form,
        client_id: Number(form.client_id)
      });
      setForm({ client_id: "", status: "prospect", source: "", notes: "" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="pipeline-page">
      <div className="page-head">
        <h2>Pipeline commercial</h2>
      </div>
      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="card-grid">
          <div className="card">
            <p className="card-label">Taux conversion global</p>
            <p className="card-value">{Number(stats.conversion_global || 0).toFixed(1)}%</p>
          </div>
          <div className="card">
            <p className="card-label">Sources trackees</p>
            <p className="card-value">{(stats.conversion_by_source || []).length}</p>
          </div>
          <div className="card">
            <p className="card-label">Prospects (12 mois)</p>
            <p className="card-value">
              {(stats.prospects_by_month || []).reduce((acc, item) => acc + Number(item.prospects || 0), 0)}
            </p>
          </div>
        </div>
      )}

      <form className="form-grid" onSubmit={submit}>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input placeholder="Source (Instagram, bouche-a-oreille...)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="primary-action" style={{ gridColumn: "1 / -1" }}>Mettre a jour</button>
      </form>

      <div className="table-wrap">
        <table className="mobile-cards-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Statut</th>
              <th>Source</th>
              <th>Derniere maj</th>
            </tr>
          </thead>
          <tbody>
            {pipeline.map((p) => (
              <tr key={p.id}>
                <td data-label="Client">{p.company_name}</td>
                <td data-label="Statut">{statuses.find((s) => s.value === p.status)?.label || p.status}</td>
                <td data-label="Source">{p.source || p.source_channel || "-"}</td>
                <td data-label="Derniere maj">{p.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mobile-cards-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Taux conversion</th>
                <th>Total prospects</th>
              </tr>
            </thead>
            <tbody>
              {(stats.conversion_by_source || []).map((s) => (
                <tr key={s.source}>
                  <td data-label="Source">{s.source}</td>
                  <td data-label="Taux conversion">{Number(s.conversion_rate || 0).toFixed(1)}%</td>
                  <td data-label="Total prospects">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
