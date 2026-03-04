const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { uploadsDir, documentsMaxBytes } = require("../config");
const {
  defaultPreparation,
  normalizePreparationPayload,
  buildRecommendation,
  checklistTemplate,
  mergeChecklistState,
  groupChecklistBySteps,
  getChecklistTemplateType,
  buildMissionCopySummary,
  LINKS
} = require("../services/flightPreparation");
const { buildFlightPreparationPackPdf } = require("../utils/flightPreparationPdf");

const router = express.Router();

const attachmentsDir = path.resolve(process.cwd(), uploadsDir, "flight-preparation");
fs.mkdirSync(attachmentsDir, { recursive: true });

function sanitizeFilename(name) {
  return String(name || "piece")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([a-zA-Z0-9/+.-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  try {
    return {
      mime: match[1],
      buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64")
    };
  } catch {
    return null;
  }
}

function extFromMime(mime) {
  const map = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "text/plain": "txt",
    "application/json": "json"
  };
  return map[mime] || "bin";
}

function getMissionById(missionId) {
  return db
    .prepare(
      `SELECT
         m.*,
         c.company_name,
         c.contact_name,
         c.email AS client_email,
         c.phone AS client_phone,
         d.brand,
         d.model,
         d.serial_number
       FROM missions m
       JOIN clients c ON c.id = m.client_id
       JOIN drones d ON d.id = m.drone_id
       WHERE m.id = ?`
    )
    .get(missionId);
}

function getPreparationByMissionId(missionId) {
  return db.prepare("SELECT * FROM regulatory_preparations WHERE mission_id = ?").get(missionId);
}

function getChecklist(preparationId) {
  return db
    .prepare(
      `SELECT
         id,
         template_type,
         step_key,
         step_title,
         step_order,
         item_order,
         item_key,
         label,
         description,
         obligatoire,
         state,
         link_url,
         links_json,
         sort_order
       FROM regulatory_checklist_items
       WHERE preparation_id = ?
       ORDER BY sort_order, id`
    )
    .all(preparationId);
}

function getAttachments(preparationId) {
  return db
    .prepare(
      `SELECT id, original_name, stored_name, mime_type, file_size, kind, created_at
       FROM regulatory_attachments
       WHERE preparation_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(preparationId);
}

function persistChecklist(preparationId, template = []) {
  const existing = getChecklist(preparationId);
  const merged = mergeChecklistState(template, existing);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM regulatory_checklist_items WHERE preparation_id = ?").run(preparationId);
    const insert = db.prepare(
      `INSERT INTO regulatory_checklist_items (
        preparation_id, template_type, step_key, step_title, step_order, item_order,
        item_key, label, description, obligatoire, state, link_url, links_json, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    merged.forEach((item) => {
      insert.run(
        preparationId,
        item.template_type || "OPEN",
        item.step_key || null,
        item.step_title || null,
        Number(item.step_order || 1),
        Number(item.item_order || 1),
        item.item_key,
        item.label,
        item.description || null,
        item.obligatoire ? 1 : 0,
        item.state === "done" ? "done" : "todo",
        item.link_url || null,
        item.links_json || null,
        Number(item.sort_order || 0)
      );
    });
  });
  tx();
  return getChecklist(preparationId);
}

function ensurePreparation(missionId) {
  const mission = getMissionById(missionId);
  if (!mission) return null;

  let prep = getPreparationByMissionId(missionId);
  if (!prep) {
    const defaults = defaultPreparation(mission);
    const result = db
      .prepare(
        `INSERT INTO regulatory_preparations (
          mission_id, category_type, open_subcategory, location_address, operation_date, altitude_max_m,
          flyby_status, alphatango_status, municipality_status, landowner_status, military_status,
          sora_required, sts_declaration_required, operational_authorization_required, validation_manuel, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'todo', 'todo', 'todo', 'todo', 'todo', 0, 0, 0, 0, datetime('now'))`
      )
      .run(
        missionId,
        defaults.category_type,
        defaults.open_subcategory,
        defaults.location_address || null,
        defaults.operation_date || null,
        defaults.altitude_max_m
      );
    prep = db.prepare("SELECT * FROM regulatory_preparations WHERE id = ?").get(result.lastInsertRowid);
  }

  const recommendation = buildRecommendation(prep);
  let checklist = getChecklist(prep.id);
  const expectedType = getChecklistTemplateType(prep, recommendation);
  const currentType = checklist[0]?.template_type || null;
  if (!checklist.length || currentType !== expectedType) {
    checklist = persistChecklist(prep.id, checklistTemplate(prep, recommendation));
  }

  return { mission, preparation: prep, recommendation, checklist };
}

function responsePayload(bundle) {
  if (!bundle) return null;
  const { mission, preparation, recommendation, checklist } = bundle;
  const attachments = getAttachments(preparation.id);
  const company = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};
  const checklist_steps = groupChecklistBySteps(checklist);
  return {
    mission,
    preparation,
    recommendation,
    checklist,
    checklist_steps,
    attachments,
    links: LINKS,
    copy_summary: buildMissionCopySummary(mission, preparation, recommendation),
    validation_manuel: Boolean(preparation.validation_manuel),
    company_contact: {
      company_name: company.company_name || "",
      phone: company.phone || "",
      email: company.email || ""
    }
  };
}

router.get("/missions/:missionId", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  if (!Number.isFinite(missionId)) return res.status(400).json({ message: "missionId invalide" });
  const bundle = ensurePreparation(missionId);
  if (!bundle) return res.status(404).json({ message: "Mission introuvable" });
  return res.json(responsePayload(bundle));
});

router.put("/missions/:missionId", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  if (!Number.isFinite(missionId)) return res.status(400).json({ message: "missionId invalide" });
  const bundle = ensurePreparation(missionId);
  if (!bundle) return res.status(404).json({ message: "Mission introuvable" });

  const existing = bundle.preparation;
  const next = normalizePreparationPayload(req.body || {}, existing);

  db.prepare(
    `UPDATE regulatory_preparations
     SET category_type = ?, open_subcategory = ?, specific_type = ?, pdra_type = ?,
         sora_required = ?, sts_declaration_required = ?, operational_authorization_required = ?, validation_manuel = ?,
         location_address = ?, location_lat = ?, location_lng = ?, operation_date = ?, start_time = ?, end_time = ?,
         altitude_max_m = ?, distance_to_people_m = ?, over_assemblies = ?, in_urban_area = ?, night_operation = ?,
         near_airport_or_ctr = ?, near_airport_details = ?, restricted_zone = ?, restricted_zone_details = ?,
         aircraft_class = ?, mtom_kg = ?, remote_id = ?, observers_needed = ?,
         flyby_status = ?, alphatango_status = ?, municipality_status = ?, landowner_status = ?, military_status = ?,
         doc_pack_zip_url = ?, risk_assessment_pdf_url = ?, ops_manual_extract_pdf_url = ?,
         sts_declaration_pdf_url = ?, sora_pack_pdf_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    next.category_type,
    next.open_subcategory,
    next.specific_type,
    next.pdra_type,
    next.sora_required,
    next.sts_declaration_required,
    next.operational_authorization_required,
    next.validation_manuel,
    next.location_address || null,
    next.location_lat,
    next.location_lng,
    next.operation_date || null,
    next.start_time || null,
    next.end_time || null,
    next.altitude_max_m,
    next.distance_to_people_m,
    next.over_assemblies,
    next.in_urban_area,
    next.night_operation,
    next.near_airport_or_ctr,
    next.near_airport_details || null,
    next.restricted_zone,
    next.restricted_zone_details || null,
    next.aircraft_class || null,
    next.mtom_kg,
    next.remote_id,
    next.observers_needed,
    next.flyby_status,
    next.alphatango_status,
    next.municipality_status,
    next.landowner_status,
    next.military_status,
    next.doc_pack_zip_url,
    next.risk_assessment_pdf_url,
    next.ops_manual_extract_pdf_url,
    next.sts_declaration_pdf_url,
    next.sora_pack_pdf_url,
    existing.id
  );

  const updated = db.prepare("SELECT * FROM regulatory_preparations WHERE id = ?").get(existing.id);
  const recommendation = buildRecommendation(updated);
  persistChecklist(updated.id, checklistTemplate(updated, recommendation));
  const refreshed = {
    mission: bundle.mission,
    preparation: updated,
    recommendation,
    checklist: getChecklist(updated.id)
  };
  return res.json(responsePayload(refreshed));
});

router.patch("/missions/:missionId/checklist/:itemId", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  const itemId = Number(req.params.itemId);
  if (!Number.isFinite(missionId) || !Number.isFinite(itemId)) {
    return res.status(400).json({ message: "Parametres invalides" });
  }

  const prep = getPreparationByMissionId(missionId);
  if (!prep) return res.status(404).json({ message: "Preparation introuvable" });

  const item = db
    .prepare("SELECT * FROM regulatory_checklist_items WHERE id = ? AND preparation_id = ?")
    .get(itemId, prep.id);
  if (!item) return res.status(404).json({ message: "Element checklist introuvable" });

  const state = String(req.body?.state || "").toLowerCase() === "done" ? "done" : "todo";
  db.prepare(
    "UPDATE regulatory_checklist_items SET state = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(state, item.id);

  return res.json({ item: db.prepare("SELECT * FROM regulatory_checklist_items WHERE id = ?").get(item.id) });
});

router.post("/missions/:missionId/checklist/step/:stepKey/mark", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  const stepKey = String(req.params.stepKey || "").trim();
  if (!Number.isFinite(missionId) || !stepKey) return res.status(400).json({ message: "Parametres invalides" });
  const prep = getPreparationByMissionId(missionId);
  if (!prep) return res.status(404).json({ message: "Preparation introuvable" });
  const state = String(req.body?.state || "").toLowerCase() === "done" ? "done" : "todo";
  const update = db.prepare(
    `UPDATE regulatory_checklist_items
     SET state = ?, updated_at = datetime('now')
     WHERE preparation_id = ? AND step_key = ?`
  );
  const result = update.run(state, prep.id, stepKey);
  return res.json({ changed: result.changes, state });
});

router.post("/missions/:missionId/attachments", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  if (!Number.isFinite(missionId)) return res.status(400).json({ message: "missionId invalide" });
  const prep = getPreparationByMissionId(missionId);
  if (!prep) return res.status(404).json({ message: "Preparation introuvable" });

  const { file_name, file_data_url, kind } = req.body || {};
  if (!file_name || !file_data_url) {
    return res.status(400).json({ message: "file_name et file_data_url sont requis" });
  }
  const parsed = parseDataUrl(file_data_url);
  if (!parsed?.buffer?.length) return res.status(400).json({ message: "Fichier invalide (data URL)" });
  if (parsed.buffer.length > documentsMaxBytes) {
    return res.status(413).json({ message: `Fichier trop volumineux (max ${documentsMaxBytes} octets)` });
  }

  const extension = extFromMime(parsed.mime);
  const safeBase = sanitizeFilename(file_name);
  const storedName = `${Date.now()}-${safeBase || "preuve"}.${extension}`;
  const absPath = path.join(attachmentsDir, storedName);
  fs.writeFileSync(absPath, parsed.buffer);

  const result = db
    .prepare(
      `INSERT INTO regulatory_attachments (
        preparation_id, original_name, stored_name, mime_type, file_size, kind
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      prep.id,
      String(file_name),
      storedName,
      parsed.mime || null,
      parsed.buffer.length,
      String(kind || "proof")
    );

  const attachment = db
    .prepare("SELECT id, original_name, stored_name, mime_type, file_size, kind, created_at FROM regulatory_attachments WHERE id = ?")
    .get(result.lastInsertRowid);
  return res.status(201).json(attachment);
});

router.delete("/missions/:missionId/attachments/:attachmentId", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(missionId) || !Number.isFinite(attachmentId)) {
    return res.status(400).json({ message: "Parametres invalides" });
  }
  const prep = getPreparationByMissionId(missionId);
  if (!prep) return res.status(404).json({ message: "Preparation introuvable" });
  const attachment = db
    .prepare("SELECT * FROM regulatory_attachments WHERE id = ? AND preparation_id = ?")
    .get(attachmentId, prep.id);
  if (!attachment) return res.status(404).json({ message: "Piece jointe introuvable" });

  db.prepare("DELETE FROM regulatory_attachments WHERE id = ?").run(attachment.id);
  const filePath = path.join(attachmentsDir, path.basename(attachment.stored_name || ""));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Keep DB deletion even if cleanup fails.
    }
  }
  return res.status(204).send();
});

router.post("/missions/:missionId/generate-docs", authRequired, (req, res) => {
  const missionId = Number(req.params.missionId);
  if (!Number.isFinite(missionId)) return res.status(400).json({ message: "missionId invalide" });
  const prep = getPreparationByMissionId(missionId);
  if (!prep) return res.status(404).json({ message: "Preparation introuvable" });

  const basePath = `/api/flight-preparation/missions/${missionId}`;
  const payload = {
    doc_pack_zip_url: `${basePath}/pack.pdf`,
    risk_assessment_pdf_url: `${basePath}/pack.pdf`,
    ops_manual_extract_pdf_url: null,
    sts_declaration_pdf_url: prep.specific_type && prep.specific_type.startsWith("STS") ? `${basePath}/pack.pdf` : null,
    sora_pack_pdf_url:
      prep.specific_type === "SORA" || prep.specific_type === "PDRA" || prep.sora_required
        ? `${basePath}/pack.pdf`
        : null
  };

  db.prepare(
    `UPDATE regulatory_preparations
     SET doc_pack_zip_url = ?, risk_assessment_pdf_url = ?, ops_manual_extract_pdf_url = ?,
         sts_declaration_pdf_url = ?, sora_pack_pdf_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    payload.doc_pack_zip_url,
    payload.risk_assessment_pdf_url,
    payload.ops_manual_extract_pdf_url,
    payload.sts_declaration_pdf_url,
    payload.sora_pack_pdf_url,
    prep.id
  );

  return res.json(payload);
});

router.get("/missions/:missionId/pack.pdf", authRequired, async (req, res) => {
  const missionId = Number(req.params.missionId);
  if (!Number.isFinite(missionId)) return res.status(400).json({ message: "missionId invalide" });
  const bundle = ensurePreparation(missionId);
  if (!bundle) return res.status(404).json({ message: "Mission introuvable" });
  const attachments = getAttachments(bundle.preparation.id);
  const company = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};
  const pdf = await buildFlightPreparationPackPdf({
    mission: bundle.mission,
    preparation: bundle.preparation,
    recommendation: bundle.recommendation,
    checklist: bundle.checklist,
    attachments,
    company
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=preparation-mission-${bundle.mission.id || missionId}.pdf`
  );
  return res.send(pdf);
});

module.exports = router;
