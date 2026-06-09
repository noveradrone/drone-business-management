import { useEffect, useState } from "react";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

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
      <p className="page-summary">Garde une vue claire des prospects et concentre les relances prioritaires.</p>
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

      <DataRowList
        items={pipeline}
        emptyMessage="Aucun prospect dans le pipeline."
        renderTitle={(p) => p.company_name}
        renderSubtitle={(p) => statuses.find((s) => s.value === p.status)?.label || p.status}
        renderDetails={(p) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Source</span>
              <span className="data-row-value">{p.source || p.source_channel || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Maj</span>
              <span className="data-row-value">{p.updated_at}</span>
            </div>
          </div>
        )}
      />

      {stats && (
        <details className="details-panel">
          <summary>Détails conversions par source</summary>
          <DataRowList
            items={stats.conversion_by_source || []}
            className="data-row-list-compact"
            emptyMessage="Aucune source."
            getKey={(s) => s.source}
            renderTitle={(s) => s.source}
            renderDetails={(s) => (
              <div className="data-row-info-grid">
                <div className="data-row-info">
                  <span className="data-row-label">Conversion</span>
                  <span className="data-row-value">{Number(s.conversion_rate || 0).toFixed(1)}%</span>
                </div>
                <div className="data-row-info">
                  <span className="data-row-label">Prospects</span>
                  <span className="data-row-value">{s.total}</span>
                </div>
              </div>
            )}
          />
        </details>
      )}
    </div>
  );
}
