const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { uploadImageToCloudinary } = require("../services/cloudinaryService");
const { generateThermographyReport } = require("../services/thermographyAIService");
const { buildThermographyPdf } = require("../services/thermographyPdfService");

const router = express.Router();

const TYPES = new Set(["toiture", "panneaux photovoltaiques", "batiment", "electrique", "industriel", "autre"]);
const STATUTS = new Set(["brouillon", "en_cours", "termine", "rapport_genere"]);
const GRAVITES = new Set(["faible", "moderee", "elevee", "critique"]);

function clean(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  return raw === "" ? fallback : raw;
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value ? 1 : 0;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "oui"].includes(raw)) return 1;
  if (["0", "false", "no", "non"].includes(raw)) return 0;
  return fallback ? 1 : 0;
}

function normalizeInspectionInput(payload = {}, existing = {}) {
  const hasManualAiPayload =
    payload.introduction_ai !== undefined ||
    payload.methodologie_ai !== undefined ||
    payload.conclusion_ai !== undefined ||
    payload.recommandations_globales_ai !== undefined;

  const introduction_ai = clean(payload.introduction_ai, clean(existing.introduction_ai));
  const methodologie_ai = clean(payload.methodologie_ai, clean(existing.methodologie_ai));
  const conclusion_ai = clean(payload.conclusion_ai, clean(existing.conclusion_ai));
  const recommandations_globales_ai = clean(
    payload.recommandations_globales_ai,
    clean(existing.recommandations_globales_ai)
  );

  const aiChangedManually =
    hasManualAiPayload &&
    (introduction_ai !== clean(existing.introduction_ai) ||
      methodologie_ai !== clean(existing.methodologie_ai) ||
      conclusion_ai !== clean(existing.conclusion_ai) ||
      recommandations_globales_ai !== clean(existing.recommandations_globales_ai));

  const next = {
    client_id: Number(payload.client_id ?? existing.client_id),
    titre: clean(payload.titre, clean(existing.titre)),
    adresse: clean(payload.adresse, clean(existing.adresse)),
    date_inspection: clean(payload.date_inspection, clean(existing.date_inspection)),
    type_inspection: clean(payload.type_inspection, clean(existing.type_inspection, "autre")).toLowerCase(),
    drone_utilise: clean(payload.drone_utilise, clean(existing.drone_utilise)),
    camera_thermique: clean(payload.camera_thermique, clean(existing.camera_thermique)),
    temperature_ambiante: toNumber(payload.temperature_ambiante, toNumber(existing.temperature_ambiante, null)),
    meteo: clean(payload.meteo, clean(existing.meteo)),
    vent: clean(payload.vent, clean(existing.vent)),
    operateur: clean(payload.operateur, clean(existing.operateur)),
    objectif_mission: clean(payload.objectif_mission, clean(existing.objectif_mission)),
    observations_generales: clean(payload.observations_generales, clean(existing.observations_generales)),
    introduction_ai,
    methodologie_ai,
    conclusion_ai,
    recommandations_globales_ai,
    ai_edited:
      payload.ai_edited !== undefined
        ? toBoolInt(payload.ai_edited, toBoolInt(existing.ai_edited, 0))
        : aiChangedManually
          ? 1
          : toBoolInt(existing.ai_edited, 0),
    statut: clean(payload.statut, clean(existing.statut, "brouillon")).toLowerCase()
  };

  if (!Number.isFinite(next.client_id)) throw new Error("Client invalide.");
  if (!next.titre) throw new Error("Le titre est obligatoire.");
  if (!next.date_inspection) throw new Error("La date d'inspection est obligatoire.");
  if (!TYPES.has(next.type_inspection)) next.type_inspection = "autre";
  if (!STATUTS.has(next.statut)) next.statut = "brouillon";
  return next;
}

function normalizeAnomalyInput(payload = {}, existing = {}) {
  const temperature_max = toNumber(payload.temperature_max, toNumber(existing.temperature_max, null));
  const temperature_min = toNumber(payload.temperature_min, toNumber(existing.temperature_min, null));
  const explicitDelta = toNumber(payload.ecart_thermique, toNumber(existing.ecart_thermique, null));
  const computedDelta =
    explicitDelta !== null
      ? explicitDelta
      : temperature_max !== null && temperature_min !== null
        ? temperature_max - temperature_min
        : null;

  const gravite = clean(payload.gravite, clean(existing.gravite, "moderee")).toLowerCase();

  const next = {
    titre: clean(payload.titre, clean(existing.titre)),
    zone: clean(payload.zone, clean(existing.zone)),
    type_anomalie: clean(payload.type_anomalie, clean(existing.type_anomalie)),
    image_thermique_url: clean(payload.image_thermique_url, clean(existing.image_thermique_url)),
    image_visible_url: clean(payload.image_visible_url, clean(existing.image_visible_url)),
    image_thermique_data_url: clean(payload.image_thermique_data_url),
    image_visible_data_url: clean(payload.image_visible_data_url),
    temperature_max,
    temperature_min,
    ecart_thermique: computedDelta,
    gravite: GRAVITES.has(gravite) ? gravite : "moderee",
    description_terrain: clean(payload.description_terrain, clean(existing.description_terrain)),
    causes_probables: clean(payload.causes_probables, clean(existing.causes_probables)),
    risques_potentiels: clean(payload.risques_potentiels, clean(existing.risques_potentiels)),
    verification_recommandee: clean(payload.verification_recommandee, clean(existing.verification_recommandee)),
    interpretation_ai: clean(payload.interpretation_ai, clean(existing.interpretation_ai)),
    recommandation_ai: clean(payload.recommandation_ai, clean(existing.recommandation_ai)),
    ordre_affichage: Number(payload.ordre_affichage ?? existing.ordre_affichage ?? 1)
  };
  if (!next.titre) throw new Error("Le titre de l'anomalie est obligatoire.");
  return next;
}

function getInspectionOwnedByUser(inspectionId, userId) {
  return db
    .prepare(
      `SELECT it.*, c.company_name, c.contact_name, c.email AS client_email, c.phone AS client_phone
       FROM inspections_thermo it
       JOIN clients c ON c.id = it.client_id
       WHERE it.id = ? AND it.user_id = ?`
    )
    .get(inspectionId, userId);
}

function listAnomalies(inspectionId) {
  return db
    .prepare(
      `SELECT *
       FROM inspection_anomalies
       WHERE inspection_id = ?
       ORDER BY ordre_affichage ASC, id ASC`
    )
    .all(inspectionId);
}

function listReportImages(inspectionId) {
  return db
    .prepare(
      `SELECT *
       FROM inspection_report_images
       WHERE inspection_id = ?
       ORDER BY ordre_affichage ASC, id ASC`
    )
    .all(inspectionId);
}

function normalizeReportImageInput(payload = {}, existing = {}) {
  return {
    image_url: clean(payload.image_url, clean(existing.image_url)),
    image_data_url: clean(payload.image_data_url),
    titre: clean(payload.titre, clean(existing.titre)),
    legende: clean(payload.legende, clean(existing.legende)),
    ordre_affichage: Number(payload.ordre_affichage ?? existing.ordre_affichage ?? 1)
  };
}

async function maybeUploadImageFromPayload(dataUrl, folder, fallbackUrl = "") {
  if (!dataUrl) return fallbackUrl || "";
  const uploaded = await uploadImageToCloudinary(dataUrl, { folder });
  return uploaded.secure_url || fallbackUrl || "";
}

router.get("/", authRequired, (req, res) => {
  const { q = "", client_id = "", type_inspection = "", statut = "", from = "", to = "" } = req.query || {};
  const rows = db
    .prepare(
      `SELECT it.id, it.client_id, it.titre, it.adresse, it.date_inspection, it.type_inspection, it.statut, it.operateur, it.updated_at,
              c.company_name
       FROM inspections_thermo it
       JOIN clients c ON c.id = it.client_id
       WHERE it.user_id = ?
         AND (? = '' OR lower(it.titre) LIKE lower(?) OR lower(c.company_name) LIKE lower(?))
         AND (? = '' OR it.client_id = ?)
         AND (? = '' OR it.type_inspection = ?)
         AND (? = '' OR it.statut = ?)
         AND (? = '' OR it.date_inspection >= ?)
         AND (? = '' OR it.date_inspection <= ?)
       ORDER BY it.date_inspection DESC, it.id DESC`
    )
    .all(
      req.user.id,
      q,
      `%${q}%`,
      `%${q}%`,
      client_id,
      client_id,
      type_inspection,
      type_inspection,
      statut,
      statut,
      from,
      from,
      to,
      to
    );
  return res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  try {
    const payload = normalizeInspectionInput(req.body || {});
    const result = db
      .prepare(
        `INSERT INTO inspections_thermo (
          user_id, client_id, titre, adresse, date_inspection, type_inspection, drone_utilise, camera_thermique,
          temperature_ambiante, meteo, vent, operateur, objectif_mission, observations_generales,
          introduction_ai, methodologie_ai, conclusion_ai, recommandations_globales_ai, ai_edited, statut, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        req.user.id,
        payload.client_id,
        payload.titre,
        payload.adresse || null,
        payload.date_inspection,
        payload.type_inspection,
        payload.drone_utilise || null,
        payload.camera_thermique || null,
        payload.temperature_ambiante,
        payload.meteo || null,
        payload.vent || null,
        payload.operateur || null,
        payload.objectif_mission || null,
        payload.observations_generales || null,
        payload.introduction_ai || null,
        payload.methodologie_ai || null,
        payload.conclusion_ai || null,
        payload.recommandations_globales_ai || null,
        payload.ai_edited || 0,
        payload.statut
      );
    const created = getInspectionOwnedByUser(result.lastInsertRowid, req.user.id);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Creation inspection impossible." });
  }
});

router.get("/:id", authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inspection invalide." });
  const inspection = getInspectionOwnedByUser(id, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const anomalies = listAnomalies(id);
  const report_images = listReportImages(id);
  return res.json({ inspection, anomalies, report_images });
});

router.put("/:id", authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inspection invalide." });
  const existing = getInspectionOwnedByUser(id, req.user.id);
  if (!existing) return res.status(404).json({ message: "Inspection introuvable." });

  try {
    const payload = normalizeInspectionInput(req.body || {}, existing);
    db.prepare(
      `UPDATE inspections_thermo
       SET client_id = ?, titre = ?, adresse = ?, date_inspection = ?, type_inspection = ?, drone_utilise = ?,
           camera_thermique = ?, temperature_ambiante = ?, meteo = ?, vent = ?, operateur = ?, objectif_mission = ?,
           observations_generales = ?, introduction_ai = ?, methodologie_ai = ?, conclusion_ai = ?,
           recommandations_globales_ai = ?, ai_edited = ?, statut = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      payload.client_id,
      payload.titre,
      payload.adresse || null,
      payload.date_inspection,
      payload.type_inspection,
      payload.drone_utilise || null,
      payload.camera_thermique || null,
      payload.temperature_ambiante,
      payload.meteo || null,
      payload.vent || null,
      payload.operateur || null,
      payload.objectif_mission || null,
      payload.observations_generales || null,
      payload.introduction_ai || null,
      payload.methodologie_ai || null,
      payload.conclusion_ai || null,
      payload.recommandations_globales_ai || null,
      payload.ai_edited || 0,
      payload.statut,
      id,
      req.user.id
    );
    return res.json(getInspectionOwnedByUser(id, req.user.id));
  } catch (error) {
    return res.status(400).json({ message: error.message || "Mise a jour impossible." });
  }
});

router.delete("/:id", authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inspection invalide." });
  const result = db.prepare("DELETE FROM inspections_thermo WHERE id = ? AND user_id = ?").run(id, req.user.id);
  if (!result.changes) return res.status(404).json({ message: "Inspection introuvable." });
  return res.status(204).send();
});

router.post("/:id/anomalies", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  if (!Number.isFinite(inspectionId)) return res.status(400).json({ message: "ID inspection invalide." });
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });

  try {
    const payload = normalizeAnomalyInput(req.body || {});
    const folder = `drone-business/thermography/user-${req.user.id}/inspection-${inspectionId}`;
    const thermalUrl = await maybeUploadImageFromPayload(payload.image_thermique_data_url, folder, payload.image_thermique_url);
    const visibleUrl = await maybeUploadImageFromPayload(payload.image_visible_data_url, folder, payload.image_visible_url);

    const result = db
      .prepare(
        `INSERT INTO inspection_anomalies (
          inspection_id, titre, zone, type_anomalie, image_thermique_url, image_visible_url,
          temperature_max, temperature_min, ecart_thermique, gravite, description_terrain,
          causes_probables, risques_potentiels, verification_recommandee, interpretation_ai, recommandation_ai,
          ordre_affichage, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        inspectionId,
        payload.titre,
        payload.zone || null,
        payload.type_anomalie || null,
        thermalUrl || null,
        visibleUrl || null,
        payload.temperature_max,
        payload.temperature_min,
        payload.ecart_thermique,
        payload.gravite,
        payload.description_terrain || null,
        payload.causes_probables || null,
        payload.risques_potentiels || null,
        payload.verification_recommandee || null,
        payload.interpretation_ai || null,
        payload.recommandation_ai || null,
        payload.ordre_affichage
      );
    const created = db.prepare("SELECT * FROM inspection_anomalies WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Creation anomalie impossible." });
  }
});

router.put("/:id/anomalies/:anomalyId", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  const anomalyId = Number(req.params.anomalyId);
  if (!Number.isFinite(inspectionId) || !Number.isFinite(anomalyId)) {
    return res.status(400).json({ message: "IDs invalides." });
  }
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const existing = db
    .prepare("SELECT * FROM inspection_anomalies WHERE id = ? AND inspection_id = ?")
    .get(anomalyId, inspectionId);
  if (!existing) return res.status(404).json({ message: "Anomalie introuvable." });

  try {
    const payload = normalizeAnomalyInput(req.body || {}, existing);
    const folder = `drone-business/thermography/user-${req.user.id}/inspection-${inspectionId}`;
    const thermalUrl = await maybeUploadImageFromPayload(payload.image_thermique_data_url, folder, payload.image_thermique_url);
    const visibleUrl = await maybeUploadImageFromPayload(payload.image_visible_data_url, folder, payload.image_visible_url);

    db.prepare(
      `UPDATE inspection_anomalies
       SET titre = ?, zone = ?, type_anomalie = ?, image_thermique_url = ?, image_visible_url = ?,
           temperature_max = ?, temperature_min = ?, ecart_thermique = ?, gravite = ?, description_terrain = ?,
           causes_probables = ?, risques_potentiels = ?, verification_recommandee = ?, interpretation_ai = ?,
           recommandation_ai = ?, ordre_affichage = ?, updated_at = datetime('now')
       WHERE id = ? AND inspection_id = ?`
    ).run(
      payload.titre,
      payload.zone || null,
      payload.type_anomalie || null,
      thermalUrl || null,
      visibleUrl || null,
      payload.temperature_max,
      payload.temperature_min,
      payload.ecart_thermique,
      payload.gravite,
      payload.description_terrain || null,
      payload.causes_probables || null,
      payload.risques_potentiels || null,
      payload.verification_recommandee || null,
      payload.interpretation_ai || null,
      payload.recommandation_ai || null,
      payload.ordre_affichage,
      anomalyId,
      inspectionId
    );
    const updated = db.prepare("SELECT * FROM inspection_anomalies WHERE id = ?").get(anomalyId);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Mise a jour anomalie impossible." });
  }
});

router.delete("/:id/anomalies/:anomalyId", authRequired, (req, res) => {
  const inspectionId = Number(req.params.id);
  const anomalyId = Number(req.params.anomalyId);
  if (!Number.isFinite(inspectionId) || !Number.isFinite(anomalyId)) {
    return res.status(400).json({ message: "IDs invalides." });
  }
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const result = db
    .prepare("DELETE FROM inspection_anomalies WHERE id = ? AND inspection_id = ?")
    .run(anomalyId, inspectionId);
  if (!result.changes) return res.status(404).json({ message: "Anomalie introuvable." });
  return res.status(204).send();
});

router.post("/:id/anomalies/:anomalyId/upload", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  const anomalyId = Number(req.params.anomalyId);
  const kind = clean(req.body?.kind).toLowerCase();
  const dataUrl = clean(req.body?.file_data_url);
  if (!Number.isFinite(inspectionId) || !Number.isFinite(anomalyId)) {
    return res.status(400).json({ message: "IDs invalides." });
  }
  if (!dataUrl) return res.status(400).json({ message: "Fichier image requis." });
  if (kind !== "thermique" && kind !== "visible") {
    return res.status(400).json({ message: "Type image invalide (thermique|visible)." });
  }

  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const anomaly = db
    .prepare("SELECT * FROM inspection_anomalies WHERE id = ? AND inspection_id = ?")
    .get(anomalyId, inspectionId);
  if (!anomaly) return res.status(404).json({ message: "Anomalie introuvable." });

  try {
    const folder = `drone-business/thermography/user-${req.user.id}/inspection-${inspectionId}`;
    const uploaded = await uploadImageToCloudinary(dataUrl, { folder });
    const field = kind === "thermique" ? "image_thermique_url" : "image_visible_url";
    db.prepare(
      `UPDATE inspection_anomalies
       SET ${field} = ?, updated_at = datetime('now')
       WHERE id = ? AND inspection_id = ?`
    ).run(uploaded.secure_url, anomalyId, inspectionId);
    return res.json({ kind, url: uploaded.secure_url });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Upload image impossible." });
  }
});

router.post("/:id/report-images", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  if (!Number.isFinite(inspectionId)) return res.status(400).json({ message: "ID inspection invalide." });
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });

  try {
    const payload = normalizeReportImageInput(req.body || {});
    if (!payload.image_url && !payload.image_data_url) {
      return res.status(400).json({ message: "Image requise." });
    }
    const folder = `drone-business/thermography/user-${req.user.id}/inspection-${inspectionId}/report-images`;
    const imageUrl = await maybeUploadImageFromPayload(payload.image_data_url, folder, payload.image_url);
    if (!imageUrl) return res.status(400).json({ message: "Image invalide." });

    const result = db
      .prepare(
        `INSERT INTO inspection_report_images (
          inspection_id, image_url, titre, legende, ordre_affichage, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(inspectionId, imageUrl, payload.titre || null, payload.legende || null, payload.ordre_affichage);

    const created = db.prepare("SELECT * FROM inspection_report_images WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Ajout image impossible." });
  }
});

router.put("/:id/report-images/:imageId", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!Number.isFinite(inspectionId) || !Number.isFinite(imageId)) {
    return res.status(400).json({ message: "IDs invalides." });
  }
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const existing = db
    .prepare("SELECT * FROM inspection_report_images WHERE id = ? AND inspection_id = ?")
    .get(imageId, inspectionId);
  if (!existing) return res.status(404).json({ message: "Image introuvable." });

  try {
    const payload = normalizeReportImageInput(req.body || {}, existing);
    const folder = `drone-business/thermography/user-${req.user.id}/inspection-${inspectionId}/report-images`;
    const imageUrl = await maybeUploadImageFromPayload(payload.image_data_url, folder, payload.image_url);
    if (!imageUrl) return res.status(400).json({ message: "Image invalide." });

    db.prepare(
      `UPDATE inspection_report_images
       SET image_url = ?, titre = ?, legende = ?, ordre_affichage = ?, updated_at = datetime('now')
       WHERE id = ? AND inspection_id = ?`
    ).run(imageUrl, payload.titre || null, payload.legende || null, payload.ordre_affichage, imageId, inspectionId);

    const updated = db.prepare("SELECT * FROM inspection_report_images WHERE id = ?").get(imageId);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Mise a jour image impossible." });
  }
});

router.delete("/:id/report-images/:imageId", authRequired, (req, res) => {
  const inspectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!Number.isFinite(inspectionId) || !Number.isFinite(imageId)) {
    return res.status(400).json({ message: "IDs invalides." });
  }
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const result = db
    .prepare("DELETE FROM inspection_report_images WHERE id = ? AND inspection_id = ?")
    .run(imageId, inspectionId);
  if (!result.changes) return res.status(404).json({ message: "Image introuvable." });
  return res.status(204).send();
});

async function handleGenerateAi(req, res) {
  const inspectionId = Number(req.params.id);
  if (!Number.isFinite(inspectionId)) return res.status(400).json({ message: "ID inspection invalide." });
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const anomalies = listAnomalies(inspectionId);
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(inspection.client_id);
  const force = toBoolInt(req.body?.force, 0);

  if (toBoolInt(inspection.ai_edited, 0) && !force) {
    return res.status(409).json({
      message: "Le texte IA a ete modifie manuellement. Confirmez la regeneration pour ecraser les modifications.",
      code: "AI_TEXT_EDITED"
    });
  }

  try {
    const report = await generateThermographyReport({ inspection, anomalies, client });
    db.prepare(
      `UPDATE inspections_thermo
       SET introduction_ai = ?, methodologie_ai = ?, conclusion_ai = ?, recommandations_globales_ai = ?,
           ai_edited = 0, statut = 'rapport_genere', updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      report.introduction_ai || null,
      report.methodologie_ai || null,
      report.conclusion_ai || null,
      report.recommandations_globales_ai || null,
      inspectionId,
      req.user.id
    );

    const updateAnomaly = db.prepare(
      `UPDATE inspection_anomalies
       SET interpretation_ai = ?, recommandation_ai = ?, updated_at = datetime('now')
       WHERE id = ? AND inspection_id = ?`
    );
    (report.anomalies || []).forEach((item) => {
      const targetId = Number(item.id);
      if (!Number.isFinite(targetId)) return;
      updateAnomaly.run(
        clean(item.interpretation_ai) || null,
        clean(item.recommandation_ai) || null,
        targetId,
        inspectionId
      );
    });

    const refreshed = getInspectionOwnedByUser(inspectionId, req.user.id);
    return res.json({
      inspection: refreshed,
      anomalies: listAnomalies(inspectionId),
      report_images: listReportImages(inspectionId)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Generation IA impossible." });
  }
}

router.post("/:id/generate-ai", authRequired, handleGenerateAi);
router.post("/:id/generate-report", authRequired, handleGenerateAi);

router.get("/:id/pdf", authRequired, async (req, res) => {
  const inspectionId = Number(req.params.id);
  if (!Number.isFinite(inspectionId)) return res.status(400).json({ message: "ID inspection invalide." });
  const inspection = getInspectionOwnedByUser(inspectionId, req.user.id);
  if (!inspection) return res.status(404).json({ message: "Inspection introuvable." });
  const anomalies = listAnomalies(inspectionId);
  const reportImages = listReportImages(inspectionId);
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(inspection.client_id) || {};
  const company = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};

  try {
    const pdf = await buildThermographyPdf({ inspection, anomalies, reportImages, client, company });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=rapport-thermographie-${inspection.id}.pdf`
    );
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Generation PDF impossible." });
  }
});

module.exports = router;
