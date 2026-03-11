import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DataRowList from "../components/DataRowList";

const TYPE_OPTIONS = ["toiture", "panneaux photovoltaiques", "batiment", "electrique", "industriel", "autre"];
const STATUS_OPTIONS = ["brouillon", "en_cours", "termine", "rapport_genere"];
const GRAVITY_OPTIONS = ["faible", "moderee", "elevee", "critique"];

const STATUS_LABELS = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  termine: "Termine",
  rapport_genere: "Rapport genere"
};

const emptyInspection = {
  client_id: "",
  titre: "",
  adresse: "",
  date_inspection: new Date().toISOString().slice(0, 10),
  type_inspection: "toiture",
  drone_utilise: "",
  camera_thermique: "",
  temperature_ambiante: "",
  meteo: "",
  vent: "",
  operateur: "",
  objectif_mission: "",
  observations_generales: "",
  introduction_ai: "",
  methodologie_ai: "",
  conclusion_ai: "",
  recommandations_globales_ai: "",
  ai_edited: 0,
  statut: "brouillon"
};

const emptyAnomaly = {
  id: null,
  titre: "",
  zone: "",
  type_anomalie: "",
  temperature_max: "",
  temperature_min: "",
  ecart_thermique: "",
  gravite: "moderee",
  description_terrain: "",
  causes_probables: "",
  risques_potentiels: "",
  verification_recommandee: "",
  ordre_affichage: 1,
  image_thermique_url: "",
  image_visible_url: "",
  image_thermique_data_url: "",
  image_visible_data_url: ""
};

const emptyReportImage = {
  id: null,
  titre: "",
  legende: "",
  ordre_affichage: 1,
  image_url: "",
  image_data_url: ""
};

function toPreview(url, dataUrl) {
  return dataUrl || url || "";
}

function toStatusLabel(value) {
  return STATUS_LABELS[value] || value || "-";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function tempLabel(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} degC` : "-";
}

function normalizeInspectionPayload(inspection) {
  return {
    ...inspection,
    client_id: Number(inspection.client_id),
    temperature_ambiante: inspection.temperature_ambiante === "" ? null : Number(inspection.temperature_ambiante),
    ai_edited: inspection.ai_edited ? 1 : 0
  };
}

export default function ThermographyPage() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [inspection, setInspection] = useState(emptyInspection);
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyForm, setAnomalyForm] = useState(emptyAnomaly);
  const [reportImages, setReportImages] = useState([]);
  const [reportImageForm, setReportImageForm] = useState(emptyReportImage);
  const [reportImageUploading, setReportImageUploading] = useState(false);
  const [aiEditMode, setAiEditMode] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    client_id: "",
    type_inspection: "",
    statut: "",
    from: "",
    to: ""
  });

  const selectedClient = useMemo(
    () => clients.find((c) => Number(c.id) === Number(inspection.client_id)),
    [clients, inspection.client_id]
  );

  async function loadRows() {
    try {
      const data = await api.thermography.list(filters);
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadClients() {
    try {
      setClients(await api.clients.list());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.client_id, filters.type_inspection, filters.statut, filters.from, filters.to]);

  async function loadInspection(id) {
    try {
      setError("");
      const payload = await api.thermography.get(id);
      setSelectedId(id);
      setInspection({
        client_id: payload.inspection.client_id || "",
        titre: payload.inspection.titre || "",
        adresse: payload.inspection.adresse || "",
        date_inspection: payload.inspection.date_inspection || new Date().toISOString().slice(0, 10),
        type_inspection: payload.inspection.type_inspection || "autre",
        drone_utilise: payload.inspection.drone_utilise || "",
        camera_thermique: payload.inspection.camera_thermique || "",
        temperature_ambiante: payload.inspection.temperature_ambiante ?? "",
        meteo: payload.inspection.meteo || "",
        vent: payload.inspection.vent || "",
        operateur: payload.inspection.operateur || "",
        objectif_mission: payload.inspection.objectif_mission || "",
        observations_generales: payload.inspection.observations_generales || "",
        introduction_ai: payload.inspection.introduction_ai || "",
        methodologie_ai: payload.inspection.methodologie_ai || "",
        conclusion_ai: payload.inspection.conclusion_ai || "",
        recommandations_globales_ai: payload.inspection.recommandations_globales_ai || "",
        ai_edited: Number(payload.inspection.ai_edited || 0),
        statut: payload.inspection.statut || "brouillon"
      });
      setAnomalies(payload.anomalies || []);
      setReportImages(payload.report_images || []);
      setAnomalyForm(emptyAnomaly);
      setReportImageForm(emptyReportImage);
      setAiEditMode(false);
    } catch (e) {
      setError(e.message);
    }
  }

  function resetForm() {
    setSelectedId(null);
    setInspection(emptyInspection);
    setAnomalies([]);
    setReportImages([]);
    setAnomalyForm(emptyAnomaly);
    setReportImageForm(emptyReportImage);
    setAiEditMode(false);
  }

  async function saveInspection(event) {
    if (event?.preventDefault) event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = normalizeInspectionPayload(inspection);
      if (selectedId) {
        await api.thermography.update(selectedId, payload);
        await loadInspection(selectedId);
      } else {
        const created = await api.thermography.create(payload);
        await loadInspection(created.id);
      }
      await loadRows();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeInspection(row) {
    if (!window.confirm(`Supprimer l'inspection "${row.titre}" ?`)) return;
    setError("");
    try {
      await api.thermography.remove(row.id);
      if (Number(selectedId) === Number(row.id)) resetForm();
      await loadRows();
    } catch (e) {
      setError(e.message);
    }
  }

  async function generateAi() {
    if (!selectedId) return;
    const force = !!inspection.ai_edited;
    if (force) {
      const ok = window.confirm(
        "Le texte IA a ete modifie manuellement. Regenerer le rapport ecrasera vos modifications. Continuer ?"
      );
      if (!ok) return;
    }

    setError("");
    setAiLoading(true);
    try {
      const payload = await api.thermography.generateReport(selectedId, { force });
      setInspection((prev) => ({
        ...prev,
        introduction_ai: payload.inspection.introduction_ai || "",
        methodologie_ai: payload.inspection.methodologie_ai || "",
        conclusion_ai: payload.inspection.conclusion_ai || "",
        recommandations_globales_ai: payload.inspection.recommandations_globales_ai || "",
        ai_edited: Number(payload.inspection.ai_edited || 0),
        statut: payload.inspection.statut || prev.statut
      }));
      setAnomalies(payload.anomalies || []);
      setReportImages(payload.report_images || []);
      setAiEditMode(false);
      await loadRows();
    } catch (e) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function downloadPdf() {
    if (!selectedId) return;
    setError("");
    setPdfLoading(true);
    try {
      const blob = await api.thermography.pdf(selectedId);
      downloadBlob(blob, `rapport-thermographie-${selectedId}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function onPickAnomalyImage(kind, file) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (kind === "thermique") {
        setAnomalyForm((prev) => ({ ...prev, image_thermique_data_url: dataUrl }));
      } else {
        setAnomalyForm((prev) => ({ ...prev, image_visible_data_url: dataUrl }));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function editAnomaly(row) {
    setAnomalyForm({
      id: row.id,
      titre: row.titre || "",
      zone: row.zone || "",
      type_anomalie: row.type_anomalie || "",
      temperature_max: row.temperature_max ?? "",
      temperature_min: row.temperature_min ?? "",
      ecart_thermique: row.ecart_thermique ?? "",
      gravite: row.gravite || "moderee",
      description_terrain: row.description_terrain || "",
      causes_probables: row.causes_probables || "",
      risques_potentiels: row.risques_potentiels || "",
      verification_recommandee: row.verification_recommandee || "",
      ordre_affichage: row.ordre_affichage || 1,
      image_thermique_url: row.image_thermique_url || "",
      image_visible_url: row.image_visible_url || "",
      image_thermique_data_url: "",
      image_visible_data_url: ""
    });
  }

  async function saveAnomaly(event) {
    event.preventDefault();
    if (!selectedId) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...anomalyForm,
        temperature_max: anomalyForm.temperature_max === "" ? null : Number(anomalyForm.temperature_max),
        temperature_min: anomalyForm.temperature_min === "" ? null : Number(anomalyForm.temperature_min),
        ecart_thermique: anomalyForm.ecart_thermique === "" ? null : Number(anomalyForm.ecart_thermique),
        ordre_affichage: Number(anomalyForm.ordre_affichage || 1)
      };
      if (anomalyForm.id) {
        await api.thermography.updateAnomaly(selectedId, anomalyForm.id, payload);
      } else {
        await api.thermography.addAnomaly(selectedId, payload);
      }
      await loadInspection(selectedId);
      setAnomalyForm(emptyAnomaly);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAnomaly(row) {
    if (!selectedId) return;
    if (!window.confirm(`Supprimer l'anomalie "${row.titre}" ?`)) return;
    setError("");
    try {
      await api.thermography.removeAnomaly(selectedId, row.id);
      await loadInspection(selectedId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function onPickReportImage(file) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReportImageForm((prev) => ({ ...prev, image_data_url: dataUrl }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function uploadMultipleReportImages(fileList = []) {
    if (!selectedId || !fileList.length) return;
    setError("");
    setReportImageUploading(true);
    try {
      const maxOrder = reportImages.reduce((acc, item) => Math.max(acc, Number(item.ordre_affichage || 0)), 0);
      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i];
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await readFileAsDataUrl(file);
        const baseName = String(file?.name || `Image-${i + 1}`).replace(/\.[^.]+$/, "");
        // eslint-disable-next-line no-await-in-loop
        await api.thermography.addReportImage(selectedId, {
          titre: baseName,
          legende: "",
          ordre_affichage: maxOrder + i + 1,
          image_data_url: dataUrl
        });
      }
      await loadInspection(selectedId);
    } catch (e) {
      setError(e.message);
    } finally {
      setReportImageUploading(false);
    }
  }

  function editReportImage(row) {
    setReportImageForm({
      id: row.id,
      titre: row.titre || "",
      legende: row.legende || "",
      ordre_affichage: row.ordre_affichage || 1,
      image_url: row.image_url || "",
      image_data_url: ""
    });
  }

  function clearReportImageForm() {
    setReportImageForm(emptyReportImage);
  }

  async function saveReportImage(event) {
    event.preventDefault();
    if (!selectedId) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        titre: reportImageForm.titre,
        legende: reportImageForm.legende,
        ordre_affichage: Number(reportImageForm.ordre_affichage || 1),
        image_url: reportImageForm.image_url,
        image_data_url: reportImageForm.image_data_url
      };

      if (reportImageForm.id) {
        await api.thermography.updateReportImage(selectedId, reportImageForm.id, payload);
      } else {
        await api.thermography.addReportImage(selectedId, payload);
      }

      await loadInspection(selectedId);
      clearReportImageForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeReportImage(row) {
    if (!selectedId) return;
    if (!window.confirm(`Supprimer l'image "${row.titre || `#${row.id}`}" ?`)) return;
    setError("");
    try {
      await api.thermography.removeReportImage(selectedId, row.id);
      await loadInspection(selectedId);
      if (reportImageForm.id === row.id) clearReportImageForm();
    } catch (e) {
      setError(e.message);
    }
  }

  function markAiEdited(field, value) {
    setInspection((prev) => ({
      ...prev,
      [field]: value,
      ai_edited: 1
    }));
  }

  return (
    <div className="thermography-page stack">
      <div className="page-header">
        <h2 className="page-title">Thermographie</h2>
        <div className="page-action">
          <button className="secondary" onClick={resetForm}>
            Nouvelle inspection
          </button>
        </div>
      </div>
      <p className="page-subtitle page-summary">
        Cree des inspections thermographiques, ajoute des anomalies avec photos, puis genere automatiquement le rapport IA et le PDF premium.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <section className="card card-section stack">
        <div className="page-head page-head-sub">
          <h3>Liste des inspections</h3>
        </div>

        <div className="form-grid thermo-filter-grid">
          <input
            placeholder="Recherche titre/client"
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          />
          <select
            value={filters.client_id}
            onChange={(e) => setFilters((p) => ({ ...p, client_id: e.target.value }))}
          >
            <option value="">Tous clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
          <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
          <select
            value={filters.type_inspection}
            onChange={(e) => setFilters((p) => ({ ...p, type_inspection: e.target.value }))}
          >
            <option value="">Tous types</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filters.statut}
            onChange={(e) => setFilters((p) => ({ ...p, statut: e.target.value }))}
          >
            <option value="">Tous statuts</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {toStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <DataRowList
        className="thermo-inspection-list"
        items={rows}
        emptyMessage="Aucune inspection thermographique."
        renderTitle={(row) => row.titre}
        renderSubtitle={(row) => `${row.company_name || "Client inconnu"} - ${row.date_inspection}`}
        renderDetails={(row) => (
          <div className="data-row-info-grid">
            <div className="data-row-info">
              <span className="data-row-label">Type</span>
              <span className="data-row-value">{row.type_inspection || "-"}</span>
            </div>
            <div className="data-row-info">
              <span className="data-row-label">Statut</span>
              <span className={`status-pill status-${row.statut || "brouillon"}`}>{toStatusLabel(row.statut)}</span>
            </div>
          </div>
        )}
        renderActions={(row) => (
          <>
            <button className="secondary" onClick={() => loadInspection(row.id)}>
              Voir
            </button>
            <button className="secondary" onClick={() => loadInspection(row.id)}>
              Modifier
            </button>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const blob = await api.thermography.pdf(row.id);
                  downloadBlob(blob, `rapport-thermographie-${row.id}.pdf`);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Generer PDF
            </button>
            <button className="danger" onClick={() => removeInspection(row)}>
              Supprimer
            </button>
          </>
        )}
      />

      <section className="card card-section stack">
        <div className="page-head page-head-sub">
          <h3>{selectedId ? `Inspection #${selectedId}` : "Nouvelle inspection"}</h3>
          <div className="actions-cell thermo-primary-actions">
            <button onClick={saveInspection} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer inspection"}
            </button>
            <button className="secondary" onClick={generateAi} disabled={!selectedId || aiLoading}>
              {aiLoading ? "Generation IA..." : "Generer tout le rapport"}
            </button>
            <button className="secondary" onClick={downloadPdf} disabled={!selectedId || pdfLoading}>
              {pdfLoading ? "Generation PDF..." : "Telecharger le PDF"}
            </button>
          </div>
        </div>

        <form className="form-grid thermo-form-grid" onSubmit={saveInspection}>
          <select value={inspection.client_id} onChange={(e) => setInspection((p) => ({ ...p, client_id: e.target.value }))} required>
            <option value="">Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <input
            placeholder="Titre inspection"
            value={inspection.titre}
            onChange={(e) => setInspection((p) => ({ ...p, titre: e.target.value }))}
            required
          />
          <input
            placeholder="Adresse"
            value={inspection.adresse}
            onChange={(e) => setInspection((p) => ({ ...p, adresse: e.target.value }))}
          />
          <input
            type="date"
            value={inspection.date_inspection}
            onChange={(e) => setInspection((p) => ({ ...p, date_inspection: e.target.value }))}
            required
          />

          <select
            value={inspection.type_inspection}
            onChange={(e) => setInspection((p) => ({ ...p, type_inspection: e.target.value }))}
          >
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            placeholder="Objectif mission"
            value={inspection.objectif_mission}
            onChange={(e) => setInspection((p) => ({ ...p, objectif_mission: e.target.value }))}
          />
          <input
            placeholder="Drone utilise"
            value={inspection.drone_utilise}
            onChange={(e) => setInspection((p) => ({ ...p, drone_utilise: e.target.value }))}
          />
          <input
            placeholder="Camera thermique"
            value={inspection.camera_thermique}
            onChange={(e) => setInspection((p) => ({ ...p, camera_thermique: e.target.value }))}
          />

          <input
            type="number"
            step="0.1"
            placeholder="Temperature ambiante"
            value={inspection.temperature_ambiante}
            onChange={(e) => setInspection((p) => ({ ...p, temperature_ambiante: e.target.value }))}
          />
          <input placeholder="Meteo" value={inspection.meteo} onChange={(e) => setInspection((p) => ({ ...p, meteo: e.target.value }))} />
          <input placeholder="Vent" value={inspection.vent} onChange={(e) => setInspection((p) => ({ ...p, vent: e.target.value }))} />
          <input
            placeholder="Operateur"
            value={inspection.operateur}
            onChange={(e) => setInspection((p) => ({ ...p, operateur: e.target.value }))}
          />

          <select value={inspection.statut} onChange={(e) => setInspection((p) => ({ ...p, statut: e.target.value }))}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {toStatusLabel(status)}
              </option>
            ))}
          </select>
          <textarea
            style={{ gridColumn: "1 / -1", minHeight: 96 }}
            placeholder="Observations generales"
            value={inspection.observations_generales}
            onChange={(e) => setInspection((p) => ({ ...p, observations_generales: e.target.value }))}
          />
        </form>

        {selectedId ? (
          <div className="card card-section thermo-section stack">
            <div className="page-head page-head-sub">
              <h3>Anomalies</h3>
            </div>

            <form className="form-grid thermo-form-grid" onSubmit={saveAnomaly}>
              <input
                placeholder="Titre anomalie"
                value={anomalyForm.titre}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, titre: e.target.value }))}
                required
              />
              <input placeholder="Zone" value={anomalyForm.zone} onChange={(e) => setAnomalyForm((p) => ({ ...p, zone: e.target.value }))} />
              <input
                placeholder="Type anomalie"
                value={anomalyForm.type_anomalie}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, type_anomalie: e.target.value }))}
              />
              <input
                type="number"
                step="0.1"
                placeholder="Temperature max"
                value={anomalyForm.temperature_max}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, temperature_max: e.target.value }))}
              />
              <input
                type="number"
                step="0.1"
                placeholder="Temperature min"
                value={anomalyForm.temperature_min}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, temperature_min: e.target.value }))}
              />
              <input
                type="number"
                step="0.1"
                placeholder="Ecart thermique"
                value={anomalyForm.ecart_thermique}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, ecart_thermique: e.target.value }))}
              />
              <select value={anomalyForm.gravite} onChange={(e) => setAnomalyForm((p) => ({ ...p, gravite: e.target.value }))}>
                {GRAVITY_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ordre"
                value={anomalyForm.ordre_affichage}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, ordre_affichage: e.target.value }))}
              />

              <label className="checkbox-inline" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(e) => onPickAnomalyImage("thermique", e.target.files?.[0])}
                />
                Photo thermique
              </label>
              <label className="checkbox-inline" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(e) => onPickAnomalyImage("visible", e.target.files?.[0])}
                />
                Photo visible
              </label>

              <div className="form-grid-2" style={{ gridColumn: "1 / -1" }}>
                <div className="card">
                  <p className="card-label">Apercu thermique</p>
                  {toPreview(anomalyForm.image_thermique_url, anomalyForm.image_thermique_data_url) ? (
                    <img src={toPreview(anomalyForm.image_thermique_url, anomalyForm.image_thermique_data_url)} alt="Thermique" />
                  ) : (
                    <p className="documents-intro">Aucune image.</p>
                  )}
                </div>
                <div className="card">
                  <p className="card-label">Apercu visible</p>
                  {toPreview(anomalyForm.image_visible_url, anomalyForm.image_visible_data_url) ? (
                    <img src={toPreview(anomalyForm.image_visible_url, anomalyForm.image_visible_data_url)} alt="Visible" />
                  ) : (
                    <p className="documents-intro">Aucune image.</p>
                  )}
                </div>
              </div>

              <textarea
                style={{ gridColumn: "1 / -1", minHeight: 86 }}
                placeholder="Description terrain"
                value={anomalyForm.description_terrain}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, description_terrain: e.target.value }))}
              />
              <textarea
                style={{ gridColumn: "1 / -1", minHeight: 86 }}
                placeholder="Causes probables"
                value={anomalyForm.causes_probables}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, causes_probables: e.target.value }))}
              />
              <textarea
                style={{ gridColumn: "1 / -1", minHeight: 86 }}
                placeholder="Risques potentiels"
                value={anomalyForm.risques_potentiels}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, risques_potentiels: e.target.value }))}
              />
              <textarea
                style={{ gridColumn: "1 / -1", minHeight: 86 }}
                placeholder="Verification recommandee"
                value={anomalyForm.verification_recommandee}
                onChange={(e) => setAnomalyForm((p) => ({ ...p, verification_recommandee: e.target.value }))}
              />

              <div className="actions-cell" style={{ gridColumn: "1 / -1" }}>
                <button disabled={saving}>{anomalyForm.id ? "Mettre a jour anomalie" : "Ajouter anomalie"}</button>
                {anomalyForm.id ? (
                  <button type="button" className="secondary" onClick={() => setAnomalyForm(emptyAnomaly)}>
                    Annuler edition
                  </button>
                ) : null}
              </div>
            </form>

            <DataRowList
              className="thermo-anomaly-list"
              items={anomalies}
              emptyMessage="Aucune anomalie pour cette inspection."
              renderTitle={(a) => a.titre}
              renderSubtitle={(a) => `${a.zone || "Zone non precisee"} - ${a.type_anomalie || "Type non renseigne"}`}
              renderDetails={(a) => (
                <div className="data-row-info-grid">
                  <div className="data-row-info">
                    <span className="data-row-label">Temp max/min</span>
                    <span className="data-row-value">
                      {tempLabel(a.temperature_max)} / {tempLabel(a.temperature_min)}
                    </span>
                  </div>
                  <div className="data-row-info">
                    <span className="data-row-label">Ecart</span>
                    <span className="data-row-value">{tempLabel(a.ecart_thermique)}</span>
                  </div>
                  <div className="data-row-info">
                    <span className="data-row-label">Gravite</span>
                    <span className="data-row-value">{a.gravite || "-"}</span>
                  </div>
                </div>
              )}
              renderMeta={(a) => (
                <>
                  {a.image_thermique_url ? <span className="data-row-chip">Image thermique</span> : null}
                  {a.image_visible_url ? <span className="data-row-chip">Image visible</span> : null}
                </>
              )}
              renderActions={(a) => (
                <>
                  <button className="secondary" onClick={() => editAnomaly(a)}>
                    Modifier
                  </button>
                  <button className="danger" onClick={() => removeAnomaly(a)}>
                    Supprimer
                  </button>
                </>
              )}
            />
          </div>
        ) : null}

        {selectedId ? (
          <div className="card card-section thermo-section stack">
            <div className="page-head page-head-sub">
              <h3>Images complementaires du rapport</h3>
            </div>

            <form className="form-grid thermo-form-grid" onSubmit={saveReportImage}>
              <input
                placeholder="Titre image"
                value={reportImageForm.titre}
                onChange={(e) => setReportImageForm((p) => ({ ...p, titre: e.target.value }))}
              />
              <input
                placeholder="Legende"
                value={reportImageForm.legende}
                onChange={(e) => setReportImageForm((p) => ({ ...p, legende: e.target.value }))}
              />
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ordre"
                value={reportImageForm.ordre_affichage}
                onChange={(e) => setReportImageForm((p) => ({ ...p, ordre_affichage: e.target.value }))}
              />

              <label className="checkbox-inline" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    if (files.length > 1) {
                      uploadMultipleReportImages(files);
                    } else {
                      onPickReportImage(files[0]);
                    }
                  }}
                />
                Ajouter une ou plusieurs images
              </label>

              <div className="form-grid-2" style={{ gridColumn: "1 / -1" }}>
                <div className="card">
                  <p className="card-label">Apercu</p>
                  {toPreview(reportImageForm.image_url, reportImageForm.image_data_url) ? (
                    <img src={toPreview(reportImageForm.image_url, reportImageForm.image_data_url)} alt="Rapport" />
                  ) : (
                    <p className="documents-intro">Aucune image.</p>
                  )}
                </div>
                <div className="card thermo-helper-card">
                  <p className="documents-intro">Ces images seront ajoutees dans le PDF final, section illustrations complementaires.</p>
                </div>
              </div>

              <div className="actions-cell" style={{ gridColumn: "1 / -1" }}>
                <button disabled={saving || reportImageUploading}>
                  {reportImageUploading
                    ? "Import en cours..."
                    : reportImageForm.id
                      ? "Mettre a jour image"
                      : "Ajouter image"}
                </button>
                {reportImageForm.id ? (
                  <button type="button" className="secondary" onClick={clearReportImageForm}>
                    Annuler edition
                  </button>
                ) : null}
              </div>
            </form>

            <DataRowList
              className="thermo-report-image-list"
              items={reportImages}
              emptyMessage="Aucune image complementaire."
              renderTitle={(img) => img.titre || `Image #${img.id}`}
              renderSubtitle={(img) => img.legende || "Sans legende"}
              renderDetails={(img) => (
                <div className="data-row-info-grid">
                  <div className="data-row-info">
                    <span className="data-row-label">Ordre</span>
                    <span className="data-row-value">{img.ordre_affichage || 1}</span>
                  </div>
                  <div className="data-row-info">
                    <span className="data-row-label">Apercu</span>
                    <span className="data-row-value">{img.image_url ? "Image disponible" : "-"}</span>
                  </div>
                </div>
              )}
              renderMeta={(img) =>
                img.image_url ? (
                  <span className="data-row-chip">URL image</span>
                ) : null
              }
              renderActions={(img) => (
                <>
                  <button className="secondary" onClick={() => editReportImage(img)}>
                    Modifier
                  </button>
                  <button className="danger" onClick={() => removeReportImage(img)}>
                    Supprimer
                  </button>
                </>
              )}
            />
          </div>
        ) : null}

        {selectedId ? (
          <div className="card card-section thermo-section stack">
            <div className="page-head page-head-sub">
              <h3>Texte genere par IA</h3>
              <div className="actions-cell">
                {!aiEditMode ? (
                  <button type="button" className="secondary" onClick={() => setAiEditMode(true)}>
                    Modifier
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={saveInspection} disabled={saving}>
                      Enregistrer texte IA
                    </button>
                    <button type="button" className="secondary" onClick={() => setAiEditMode(false)}>
                      Annuler
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="thermo-ai-grid">
              <div className="thermo-ai-block">
                <p className="thermo-ai-label">Introduction</p>
                {aiEditMode ? (
                  <textarea
                    value={inspection.introduction_ai || ""}
                    onChange={(e) => markAiEdited("introduction_ai", e.target.value)}
                    placeholder="Introduction du rapport..."
                  />
                ) : (
                  <p className="thermo-ai-text">{inspection.introduction_ai || "-"}</p>
                )}
              </div>

              <div className="thermo-ai-block">
                <p className="thermo-ai-label">Methodologie</p>
                {aiEditMode ? (
                  <textarea
                    value={inspection.methodologie_ai || ""}
                    onChange={(e) => markAiEdited("methodologie_ai", e.target.value)}
                    placeholder="Methodologie..."
                  />
                ) : (
                  <p className="thermo-ai-text">{inspection.methodologie_ai || "-"}</p>
                )}
              </div>

              <div className="thermo-ai-block">
                <p className="thermo-ai-label">Conclusion</p>
                {aiEditMode ? (
                  <textarea
                    value={inspection.conclusion_ai || ""}
                    onChange={(e) => markAiEdited("conclusion_ai", e.target.value)}
                    placeholder="Conclusion..."
                  />
                ) : (
                  <p className="thermo-ai-text">{inspection.conclusion_ai || "-"}</p>
                )}
              </div>

              <div className="thermo-ai-block">
                <p className="thermo-ai-label">Recommandations</p>
                {aiEditMode ? (
                  <textarea
                    value={inspection.recommandations_globales_ai || ""}
                    onChange={(e) => markAiEdited("recommandations_globales_ai", e.target.value)}
                    placeholder="Recommandations..."
                  />
                ) : (
                  <p className="thermo-ai-text">{inspection.recommandations_globales_ai || "-"}</p>
                )}
              </div>
            </div>

            {inspection.ai_edited ? (
              <p className="documents-intro">Le texte IA a ete modifie manuellement et sera conserve dans le PDF.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {selectedClient ? (
        <p className="documents-intro">Client selectionne : {selectedClient.company_name}</p>
      ) : null}
    </div>
  );
}
