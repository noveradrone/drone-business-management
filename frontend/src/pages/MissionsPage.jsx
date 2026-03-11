import { useEffect, useState } from "react";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

const packOptions = ["Essentiel", "Premium", "Instagram"];
const statusOptions = ["planned", "in_progress", "completed", "cancelled"];
const MISSION_STATUS_LABELS = {
  planned: "Planifiee",
  in_progress: "En cours",
  completed: "Terminee",
  cancelled: "Annulee"
};
const prepStatuses = ["todo", "in_progress", "done"];
const STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé"
};
const OBLIGATION_LABELS = {
  requis: "Requis",
  a_verifier: "À vérifier",
  recommande: "Recommandé"
};
const OBLIGATION_CLASS = {
  requis: "requis",
  a_verifier: "a-verifier",
  recommande: "recommande"
};
const categoryTypes = ["open", "specific", "certified"];
const openSubCategories = ["A1", "A2", "A3"];
const specificTypes = ["STS-01", "STS-02", "PDRA", "SORA", "OTHER"];
const pdraTypes = ["PDRA-S01", "PDRA-S02"];

function boolToChecked(value) {
  return value === 1 || value === true;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.readAsDataURL(file);
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusPill(status) {
  const colors = {
    todo: "#b7791f",
    in_progress: "#2563eb",
    done: "#1f9d55"
  };
  const color = colors[status] || "#596476";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${color}55`,
        color,
        background: `${color}18`,
        fontSize: 12,
        fontWeight: 700
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function groupChecklistItems(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const stepKey = item.step_key || "default";
    if (!map.has(stepKey)) {
      map.set(stepKey, {
        step_key: stepKey,
        step_title: item.step_title || "Checklist",
        step_order: Number(item.step_order || 1),
        items: []
      });
    }
    map.get(stepKey).items.push({
      ...item,
      links: Array.isArray(item.links) ? item.links : item.link_url ? [item.link_url] : []
    });
  });
  return Array.from(map.values())
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      ...step,
      items: step.items.sort((a, b) => Number(a.item_order || 0) - Number(b.item_order || 0))
    }));
}

export default function MissionsPage() {
  const [missions, setMissions] = useState([]);
  const [clients, setClients] = useState([]);
  const [drones, setDrones] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prepError, setPrepError] = useState("");
  const [prepSuccess, setPrepSuccess] = useState("");
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepSaving, setPrepSaving] = useState(false);
  const [prepGenerating, setPrepGenerating] = useState(false);
  const [prepUploading, setPrepUploading] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [preparation, setPreparation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [checklistSteps, setChecklistSteps] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [copySummary, setCopySummary] = useState("");
  const [links, setLinks] = useState({});

  const [form, setForm] = useState({
    drone_id: "",
    client_id: "",
    mission_date: new Date().toISOString().slice(0, 10),
    location: "",
    duration_minutes: 30,
    flight_hours_logged: 0.5,
    cycles_logged: 1,
    preparation_hours: 0.5,
    flight_time_hours: 0.5,
    montage_hours: 0.5,
    mileage_km: 0,
    variable_costs: 0,
    department: "",
    selected_pack: "Essentiel",
    mission_status: "planned",
    photo_url: "",
    notes: ""
  });

  async function load() {
    try {
      const [missionsRows, clientsRows, dronesRows] = await Promise.all([
        api.missions.list(),
        api.clients.list(),
        api.drones.list()
      ]);
      setMissions(missionsRows);
      setClients(clientsRows);
      setDrones(dronesRows);
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
    setSubmitting(true);
    try {
      await api.missions.create({
        ...form,
        drone_id: Number(form.drone_id),
        client_id: Number(form.client_id),
        duration_minutes: Number(form.duration_minutes),
        flight_hours_logged: Number(form.flight_hours_logged),
        cycles_logged: Number(form.cycles_logged),
        preparation_hours: Number(form.preparation_hours),
        flight_time_hours: Number(form.flight_time_hours),
        montage_hours: Number(form.montage_hours),
        mileage_km: Number(form.mileage_km),
        variable_costs: Number(form.variable_costs),
        photo_url: form.photo_url || null,
        notes: form.notes || null
      });
      setForm({
        drone_id: "",
        client_id: "",
        mission_date: new Date().toISOString().slice(0, 10),
        location: "",
        duration_minutes: 30,
        flight_hours_logged: 0.5,
        cycles_logged: 1,
        preparation_hours: 0.5,
        flight_time_hours: 0.5,
        montage_hours: 0.5,
        mileage_km: 0,
        variable_costs: 0,
        department: "",
        selected_pack: "Essentiel",
        mission_status: "planned",
        photo_url: "",
        notes: ""
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMission(mission) {
    if (!window.confirm(`Supprimer la mission du ${mission.mission_date} ?`)) return;
    setError("");
    try {
      await api.missions.remove(mission.id);
      await load();
      if (selectedMission?.id === mission.id) {
        closePreparation();
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function applyPreparationPayload(payload) {
    setPreparation(payload.preparation || null);
    setRecommendation(payload.recommendation || null);
    const rows = payload.checklist || [];
    setChecklist(rows);
    setChecklistSteps(payload.checklist_steps || groupChecklistItems(rows));
    setAttachments(payload.attachments || []);
    setCopySummary(payload.copy_summary || "");
    setLinks(payload.links || {});
  }

  async function openPreparation(mission) {
    setPrepError("");
    setPrepSuccess("");
    setSelectedMission(mission);
    setPrepLoading(true);
    try {
      const payload = await api.missions.preparation(mission.id);
      applyPreparationPayload(payload);
    } catch (e) {
      setPrepError(e.message);
    } finally {
      setPrepLoading(false);
    }
  }

  function closePreparation() {
    setSelectedMission(null);
    setPreparation(null);
    setRecommendation(null);
    setChecklist([]);
    setChecklistSteps([]);
    setAttachments([]);
    setCopySummary("");
    setPrepError("");
    setPrepSuccess("");
    setLinks({});
  }

  function updatePreparationField(key, value) {
    setPreparation((prev) => ({ ...(prev || {}), [key]: value }));
    setPrepSuccess("");
  }

  async function savePreparation() {
    if (!selectedMission || !preparation) return;
    setPrepError("");
    setPrepSuccess("");
    setPrepSaving(true);
    try {
      const payload = await api.missions.updatePreparation(selectedMission.id, preparation);
      applyPreparationPayload(payload);
      setPrepSuccess("Preparation enregistree.");
    } catch (e) {
      setPrepError(e.message);
    } finally {
      setPrepSaving(false);
    }
  }

  async function toggleChecklist(item, checked) {
    if (!selectedMission) return;
    setPrepError("");
    try {
      await api.missions.updatePreparationChecklist(selectedMission.id, item.id, checked ? "done" : "todo");
      setChecklist((prev) => {
        const updated = prev.map((row) => (row.id === item.id ? { ...row, state: checked ? "done" : "todo" } : row));
        setChecklistSteps(groupChecklistItems(updated));
        return updated;
      });
    } catch (e) {
      setPrepError(e.message);
    }
  }

  async function markStep(step, done) {
    if (!selectedMission) return;
    setPrepError("");
    try {
      await api.missions.markPreparationStep(selectedMission.id, step.step_key, done ? "done" : "todo");
      setChecklist((prev) => {
        const updated = prev.map((item) =>
          item.step_key === step.step_key ? { ...item, state: done ? "done" : "todo" } : item
        );
        setChecklistSteps(groupChecklistItems(updated));
        return updated;
      });
      setPrepSuccess(done ? "Etape cochee." : "Etape reinitialisee.");
    } catch (e) {
      setPrepError(e.message);
    }
  }

  async function resetChecklistAll() {
    if (!selectedMission) return;
    setPrepError("");
    try {
      await Promise.all(checklist.map((item) => api.missions.updatePreparationChecklist(selectedMission.id, item.id, "todo")));
      const updated = checklist.map((item) => ({ ...item, state: "todo" }));
      setChecklist(updated);
      setChecklistSteps(groupChecklistItems(updated));
      setPrepSuccess("Checklist reinitialisee.");
    } catch (e) {
      setPrepError(e.message);
    }
  }

  async function copyMissionSummary() {
    try {
      await navigator.clipboard.writeText(copySummary || "");
      setPrepSuccess("Resume copie.");
    } catch {
      setPrepError("Copie impossible depuis ce navigateur.");
    }
  }

  async function generatePack() {
    if (!selectedMission) return;
    setPrepError("");
    setPrepSuccess("");
    setPrepGenerating(true);
    try {
      const generated = await api.missions.generatePreparationDocs(selectedMission.id);
      setPreparation((prev) => ({ ...(prev || {}), ...generated }));
      setPrepSuccess("Dossier mission genere.");
    } catch (e) {
      setPrepError(e.message);
    } finally {
      setPrepGenerating(false);
    }
  }

  async function downloadPack() {
    if (!selectedMission) return;
    setPrepError("");
    try {
      const blob = await api.missions.preparationPackPdf(selectedMission.id);
      download(blob, `preparation-mission-${selectedMission.id}.pdf`);
    } catch (e) {
      setPrepError(e.message);
    }
  }

  async function uploadAttachment(file) {
    if (!selectedMission || !file) return;
    setPrepError("");
    setPrepSuccess("");
    setPrepUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const created = await api.missions.uploadPreparationAttachment(selectedMission.id, {
        file_name: file.name,
        file_data_url: dataUrl,
        kind: "proof"
      });
      setAttachments((prev) => [created, ...prev]);
      setPrepSuccess("Piece ajoutee.");
    } catch (e) {
      setPrepError(e.message);
    } finally {
      setPrepUploading(false);
    }
  }

  async function removeAttachment(attachment) {
    if (!selectedMission) return;
    if (!window.confirm(`Supprimer la piece ${attachment.original_name} ?`)) return;
    setPrepError("");
    try {
      await api.missions.removePreparationAttachment(selectedMission.id, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (e) {
      setPrepError(e.message);
    }
  }

  function openExternal(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="missions-page">
      <div className="page-head">
        <h2>Missions</h2>
        <span className="pill">Pilotage terrain</span>
      </div>
      <p className="page-summary">Crée la mission rapidement puis complète les champs avancés seulement si nécessaire.</p>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={submit}>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select value={form.drone_id} onChange={(e) => setForm({ ...form, drone_id: e.target.value })} required>
          <option value="">Drone</option>
          {drones.map((d) => (
            <option key={d.id} value={d.id}>
              {d.brand} {d.model} ({d.serial_number})
            </option>
          ))}
        </select>
        <input type="date" value={form.mission_date} onChange={(e) => setForm({ ...form, mission_date: e.target.value })} required />
        <input placeholder="Lieu" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
        <input type="number" min="1" placeholder="Duree (min)" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required />
        <select value={form.selected_pack} onChange={(e) => setForm({ ...form, selected_pack: e.target.value })}>
          {packOptions.map((pack) => (
            <option key={pack} value={pack}>
              {pack}
            </option>
          ))}
        </select>
        <select value={form.mission_status} onChange={(e) => setForm({ ...form, mission_status: e.target.value })}>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {MISSION_STATUS_LABELS[status] || status}
            </option>
          ))}
        </select>

        <details className="details-panel" style={{ gridColumn: "1 / -1" }}>
          <summary>Options avancées</summary>
          <div className="nested-grid">
            <input type="number" min="0" step="0.1" placeholder="Heures log" value={form.flight_hours_logged} onChange={(e) => setForm({ ...form, flight_hours_logged: e.target.value })} required />
            <input type="number" min="0" step="1" placeholder="Cycles" value={form.cycles_logged} onChange={(e) => setForm({ ...form, cycles_logged: e.target.value })} required />
            <input type="number" min="0" step="0.1" placeholder="Temps preparation (h)" value={form.preparation_hours} onChange={(e) => setForm({ ...form, preparation_hours: e.target.value })} />
            <input type="number" min="0" step="0.1" placeholder="Temps vol (h)" value={form.flight_time_hours} onChange={(e) => setForm({ ...form, flight_time_hours: e.target.value })} />
            <input type="number" min="0" step="0.1" placeholder="Temps montage (h)" value={form.montage_hours} onChange={(e) => setForm({ ...form, montage_hours: e.target.value })} />
            <input type="number" min="0" step="0.1" placeholder="Kilometrage" value={form.mileage_km} onChange={(e) => setForm({ ...form, mileage_km: e.target.value })} />
            <input type="number" min="0" step="0.01" placeholder="Couts variables" value={form.variable_costs} onChange={(e) => setForm({ ...form, variable_costs: e.target.value })} />
            <input placeholder="Departement" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <input placeholder="URL photo (optionnel)" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            <input placeholder="Notes (optionnel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </details>
        <button className="primary-action" style={{ gridColumn: "1 / -1" }} disabled={submitting}>
          {submitting ? "Creation..." : "Creer la mission"}
        </button>
      </form>

      <DataRowList
        items={missions}
        emptyMessage="Aucune mission."
        renderTitle={(m) => `Mission #${m.id}`}
        renderSubtitle={(m) => `${m.company_name} - ${m.mission_date}`}
        renderDetails={(m) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Pack</span>
              <span className="data-row-value">{m.selected_pack || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Dep.</span>
              <span className="data-row-value">{m.department || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">CA</span>
              <span className="data-row-value">{Number(m.mission_revenue || 0).toFixed(2)} EUR</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Cout</span>
              <span className="data-row-value">{Number(m.total_cost || 0).toFixed(2)} EUR</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Marge</span>
              <span className="data-row-value">{Number(m.gross_margin || 0).toFixed(2)} EUR</span>
            </div>
          </div>
        )}
        renderMeta={(m) => (
          <>
            <span className="data-row-chip">{MISSION_STATUS_LABELS[m.mission_status] || m.mission_status}</span>
            <span className="data-row-chip">{Number(m.effective_hourly_rate || 0).toFixed(2)} EUR/h</span>
          </>
        )}
        renderActions={(m) => (
          <>
            <button type="button" className="secondary" onClick={() => openPreparation(m)}>
              Preparation de vol
            </button>
            <button type="button" className="danger" onClick={() => removeMission(m)}>
              Supprimer
            </button>
          </>
        )}
      />

      {selectedMission && (
        <div className="modal-backdrop" onClick={closePreparation}>
          <div className="modal-card prep-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: "1.15rem" }}>Preparation de vol - Mission #{selectedMission.id}</h2>
              <div className="actions-cell">
                <button type="button" className="secondary" onClick={closePreparation}>
                  Fermer
                </button>
              </div>
            </div>

            {prepError && <p className="error">{prepError}</p>}
            {prepSuccess && <p style={{ color: "var(--success)", marginBottom: 8 }}>{prepSuccess}</p>}
            {prepLoading || !preparation ? (
              <p>Chargement de la preparation...</p>
            ) : (
              <div className="prep-stack">
                <div className="card prep-summary-card">
                  <div className="page-head" style={{ marginBottom: 6 }}>
                    <h3 style={{ margin: 0 }}>Resume mission</h3>
                    <span className="pill">
                      {preparation.category_type === "open"
                        ? `Open ${preparation.open_subcategory || "A3"}`
                        : preparation.category_type === "specific"
                          ? `Specifique ${preparation.specific_type || "STS-01"}`
                          : "Certifie"}
                    </span>
                  </div>
                  <p className="documents-intro" style={{ marginBottom: 0 }}>
                    Mission #{selectedMission.id} - {selectedMission.company_name} - {selectedMission.mission_date}
                  </p>
                </div>

                <div className="prep-grid">
                <div className="card">
                  <h3>Classification mission</h3>
                  <div className="form-stack prep-form-stack">
                    <div className="form-grid-2">
                      <select value={preparation.category_type || "open"} onChange={(e) => updatePreparationField("category_type", e.target.value)}>
                        {categoryTypes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {preparation.category_type === "open" ? (
                        <select value={preparation.open_subcategory || "A3"} onChange={(e) => updatePreparationField("open_subcategory", e.target.value)}>
                          {openSubCategories.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : preparation.category_type === "specific" ? (
                        <select value={preparation.specific_type || "STS-01"} onChange={(e) => updatePreparationField("specific_type", e.target.value)}>
                          {specificTypes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input placeholder="Sous-categorie/scenario" disabled />
                      )}
                    </div>

                    {preparation.category_type === "specific" && preparation.specific_type === "PDRA" ? (
                      <div className="form-grid-2">
                        <select value={preparation.pdra_type || "PDRA-S01"} onChange={(e) => updatePreparationField("pdra_type", e.target.value)}>
                          {pdraTypes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="form-grid-2">
                      <input placeholder="Adresse operation" value={preparation.location_address || ""} onChange={(e) => updatePreparationField("location_address", e.target.value)} />
                      <input placeholder="Classe drone (C0/C1/C2...)" value={preparation.aircraft_class || ""} onChange={(e) => updatePreparationField("aircraft_class", e.target.value)} />
                    </div>

                    <div className="form-grid-2">
                      <input type="number" step="0.000001" placeholder="Latitude" value={preparation.location_lat ?? ""} onChange={(e) => updatePreparationField("location_lat", e.target.value)} />
                      <input type="number" step="0.000001" placeholder="Longitude" value={preparation.location_lng ?? ""} onChange={(e) => updatePreparationField("location_lng", e.target.value)} />
                    </div>

                    <div className="form-grid-2">
                      <input type="date" value={preparation.operation_date || ""} onChange={(e) => updatePreparationField("operation_date", e.target.value)} />
                      <input type="number" min="0" step="0.01" placeholder="MTOM (kg)" value={preparation.mtom_kg ?? ""} onChange={(e) => updatePreparationField("mtom_kg", e.target.value)} />
                    </div>

                    <div className="form-grid-2">
                      <input type="time" value={preparation.start_time || ""} onChange={(e) => updatePreparationField("start_time", e.target.value)} />
                      <input type="time" value={preparation.end_time || ""} onChange={(e) => updatePreparationField("end_time", e.target.value)} />
                    </div>

                    <div className="form-grid-2">
                      <input type="number" min="0" step="1" placeholder="Altitude max (m)" value={preparation.altitude_max_m ?? ""} onChange={(e) => updatePreparationField("altitude_max_m", e.target.value)} />
                      <input type="number" min="0" step="1" placeholder="Distance personnes (m)" value={preparation.distance_to_people_m ?? ""} onChange={(e) => updatePreparationField("distance_to_people_m", e.target.value)} />
                    </div>

                    <div className="form-grid-2 prep-flag-grid">
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.over_assemblies)} onChange={(e) => updatePreparationField("over_assemblies", e.target.checked ? 1 : 0)} /> Survol rassemblement</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.in_urban_area)} onChange={(e) => updatePreparationField("in_urban_area", e.target.checked ? 1 : 0)} /> Zone urbaine</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.night_operation)} onChange={(e) => updatePreparationField("night_operation", e.target.checked ? 1 : 0)} /> Opération de nuit</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.near_airport_or_ctr)} onChange={(e) => updatePreparationField("near_airport_or_ctr", e.target.checked ? 1 : 0)} /> Proche aeroport/CTR</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.restricted_zone)} onChange={(e) => updatePreparationField("restricted_zone", e.target.checked ? 1 : 0)} /> Zone restreinte</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.remote_id)} onChange={(e) => updatePreparationField("remote_id", e.target.checked ? 1 : 0)} /> Remote ID</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.observers_needed)} onChange={(e) => updatePreparationField("observers_needed", e.target.checked ? 1 : 0)} /> Observateur requis</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.sora_required)} onChange={(e) => updatePreparationField("sora_required", e.target.checked ? 1 : 0)} /> SORA requise</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.sts_declaration_required)} onChange={(e) => updatePreparationField("sts_declaration_required", e.target.checked ? 1 : 0)} /> Déclaration STS requise</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.operational_authorization_required)} onChange={(e) => updatePreparationField("operational_authorization_required", e.target.checked ? 1 : 0)} /> Autorisation opérationnelle</label>
                      <label className="checkbox-inline"><input type="checkbox" checked={boolToChecked(preparation.validation_manuel)} onChange={(e) => updatePreparationField("validation_manuel", e.target.checked ? 1 : 0)} /> Validation manuelle</label>
                    </div>

                    <div className="form-grid-2">
                      <input placeholder="Details aeroport/CTR" value={preparation.near_airport_details || ""} onChange={(e) => updatePreparationField("near_airport_details", e.target.value)} />
                      <input placeholder="Details zone restreinte" value={preparation.restricted_zone_details || ""} onChange={(e) => updatePreparationField("restricted_zone_details", e.target.value)} />
                    </div>
                  </div>
                  <div className="actions-cell" style={{ marginTop: 10 }}>
                    <button type="button" onClick={savePreparation} disabled={prepSaving}>
                      {prepSaving ? "Enregistrement..." : "Enregistrer preparation"}
                    </button>
                  </div>
                </div>

                <div className="card">
                  <h3>Obligations guidees</h3>
                  <p className="documents-intro">Guidage indicatif uniquement, verification manuelle obligatoire.</p>
                  <div className="prep-obligations">
                    {(recommendation?.obligations || []).map((item, idx) => (
                      <div key={`${item.text}-${idx}`} className="prep-obligation-row">
                        <strong className={`prep-obligation-badge ${OBLIGATION_CLASS[item.level] || "a-verifier"}`}>
                          {OBLIGATION_LABELS[item.level] || item.level}
                        </strong>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ margin: "12px 0 8px" }}>Statuts des demarches</h4>
                  <div className="form-grid prep-status-grid">
                    <label>
                      FlyBy
                      <select value={preparation.flyby_status || "todo"} onChange={(e) => updatePreparationField("flyby_status", e.target.value)}>
                        {prepStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      AlphaTango
                      <select value={preparation.alphatango_status || "todo"} onChange={(e) => updatePreparationField("alphatango_status", e.target.value)}>
                        {prepStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mairie
                      <select value={preparation.municipality_status || "todo"} onChange={(e) => updatePreparationField("municipality_status", e.target.value)}>
                        {prepStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Proprietaire
                      <select value={preparation.landowner_status || "todo"} onChange={(e) => updatePreparationField("landowner_status", e.target.value)}>
                        {prepStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Militaire
                      <select value={preparation.military_status || "todo"} onChange={(e) => updatePreparationField("military_status", e.target.value)}>
                        {prepStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="actions-cell" style={{ marginTop: 10 }}>
                    <button type="button" className="secondary" onClick={() => openExternal(links.flyby)}>
                      Ouvrir FlyBy
                    </button>
                    <button type="button" className="secondary" onClick={() => openExternal(links.alphaTango)}>
                      Ouvrir AlphaTango
                    </button>
                    <button type="button" className="secondary" onClick={() => openExternal(links.sia)}>
                      Ouvrir SIA
                    </button>
                    <button type="button" className="secondary" onClick={() => openExternal(links.geoportail)}>
                      Ouvrir Géoportail
                    </button>
                  </div>
                </div>

                <div className="card prep-checklist-card" style={{ gridColumn: "1 / -1" }}>
                  <div className="page-head" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Checklist dynamique</h3>
                    <div className="actions-cell">
                      <button type="button" className="secondary" onClick={resetChecklistAll}>
                        Reinitialiser
                      </button>
                    </div>
                  </div>
                  <p className="documents-intro">Modèle: {(checklistSteps[0]?.items?.[0]?.template_type || "OPEN").toUpperCase()}</p>

                  <div className="prep-checklist-steps">
                    {checklistSteps.map((step, index) => (
                      <details key={step.step_key} className="details-panel prep-step" open={index === 0}>
                        <summary>{step.step_title}</summary>
                        <div className="actions-cell" style={{ marginBottom: 8 }}>
                          <button type="button" className="secondary" onClick={() => markStep(step, true)}>
                            Tout cocher étape
                          </button>
                          <button type="button" className="secondary" onClick={() => markStep(step, false)}>
                            Réinitialiser étape
                          </button>
                        </div>
                        <div className="prep-checklist">
                          {step.items.map((item) => (
                            <label key={item.id} className="prep-check-item">
                              <input type="checkbox" checked={item.state === "done"} onChange={(e) => toggleChecklist(item, e.target.checked)} />
                              <div>
                                <div className="prep-check-head">
                                  <strong>{item.label}</strong> {statusPill(item.state)}
                                </div>
                                {item.description ? <p>{item.description}</p> : null}
                                {(item.links || []).length ? (
                                  <div className="prep-link-list">
                                    {(item.links || []).map((link) => (
                                      <a key={link} href={link} target="_blank" rel="noreferrer">
                                        {link}
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </label>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Dossier mission</h3>
                  <p className="documents-intro">Generation de fiche mission + checklist + analyse risques template.</p>
                  <div className="actions-cell">
                    <button type="button" onClick={generatePack} disabled={prepGenerating}>
                      {prepGenerating ? "Generation..." : "Generer dossier mission"}
                    </button>
                    <button type="button" className="secondary" onClick={downloadPack}>
                      Telecharger dossier PDF
                    </button>
                    <button type="button" className="secondary" onClick={copyMissionSummary}>
                      Copier le resume mission
                    </button>
                  </div>
                  <textarea value={copySummary} rows={6} readOnly style={{ marginTop: 10 }} />
                </div>

                <div className="card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Pieces justificatives</h3>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.json"
                    onChange={(e) => uploadAttachment(e.target.files?.[0])}
                    disabled={prepUploading}
                  />
                  <div className="prep-attachments">
                    {attachments.map((att) => (
                      <div key={att.id} className="prep-attachment-row">
                        <span>
                          {att.original_name} ({Number(att.file_size || 0)} o)
                        </span>
                        <button type="button" className="danger" onClick={() => removeAttachment(att)}>
                          Supprimer
                        </button>
                      </div>
                    ))}
                    {!attachments.length ? <p style={{ margin: "8px 0 0" }}>Aucune piece chargee.</p> : null}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
