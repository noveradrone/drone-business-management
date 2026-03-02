const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { uploadsDir, documentsMaxBytes } = require("../config");

const router = express.Router();
const documentsDir = path.resolve(process.cwd(), uploadsDir, "documents");
fs.mkdirSync(documentsDir, { recursive: true });

function sanitizeFilename(name) {
  return String(name || "document")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parsePdfDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:application\/pdf;base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  } catch {
    return null;
  }
}

function isLikelyPdf(buffer) {
  if (!buffer || buffer.length < 5) return false;
  // PDF files start with "%PDF-"
  return buffer.slice(0, 5).toString("utf8") === "%PDF-";
}

function getAbsoluteDocumentPath(storedPath) {
  const safeName = path.basename(String(storedPath || ""));
  return path.join(documentsDir, safeName);
}

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         id,
         nom_document,
         type_document,
         date_upload,
         chemin_fichier,
         file_size,
         version,
         created_by,
         created_at,
         updated_at
       FROM documents
       ORDER BY date_upload DESC, id DESC`
    )
    .all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const { nom_document, type_document = "autre", file_name, file_data_url } = req.body || {};
  if (!nom_document || !file_data_url) {
    return res.status(400).json({ message: "nom_document et file_data_url sont requis" });
  }

  const pdfBuffer = parsePdfDataUrl(file_data_url);
  if (!pdfBuffer || !pdfBuffer.length) {
    return res.status(400).json({ message: "Format PDF invalide (data URL attendue)" });
  }
  if (pdfBuffer.length > documentsMaxBytes) {
    return res.status(413).json({ message: `Fichier trop volumineux (max ${documentsMaxBytes} octets)` });
  }
  if (!isLikelyPdf(pdfBuffer)) {
    return res.status(400).json({ message: "Le fichier fourni n'est pas un PDF valide" });
  }

  const safeBase = sanitizeFilename(file_name || nom_document || "document");
  const finalName = `${Date.now()}-${safeBase || "document"}.pdf`;
  const absPath = path.join(documentsDir, finalName);

  try {
    fs.writeFileSync(absPath, pdfBuffer);
    const result = db
      .prepare(
        `INSERT INTO documents (
          nom_document, type_document, date_upload, chemin_fichier, file_size, version, created_by, updated_at
        ) VALUES (?, ?, datetime('now'), ?, ?, 1, ?, datetime('now'))`
      )
      .run(
        String(nom_document),
        String(type_document || "autre"),
        finalName,
        pdfBuffer.length,
        req.user.id
      );

    const created = db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id/replace", authRequired, (req, res) => {
  const { nom_document, type_document, file_name, file_data_url } = req.body || {};
  const existing = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Document introuvable" });

  let newStoredName = existing.chemin_fichier;
  let newSize = Number(existing.file_size || 0);
  let hasNewFile = false;

  if (file_data_url) {
    const pdfBuffer = parsePdfDataUrl(file_data_url);
    if (!pdfBuffer || !pdfBuffer.length) {
      return res.status(400).json({ message: "Format PDF invalide pour remplacement" });
    }
    if (pdfBuffer.length > documentsMaxBytes) {
      return res.status(413).json({ message: `Fichier trop volumineux (max ${documentsMaxBytes} octets)` });
    }
    if (!isLikelyPdf(pdfBuffer)) {
      return res.status(400).json({ message: "Le fichier fourni n'est pas un PDF valide" });
    }
    const safeBase = sanitizeFilename(file_name || nom_document || existing.nom_document || "document");
    newStoredName = `${Date.now()}-${safeBase || "document"}.pdf`;
    const absPath = path.join(documentsDir, newStoredName);
    fs.writeFileSync(absPath, pdfBuffer);
    newSize = pdfBuffer.length;
    hasNewFile = true;
  }

  db.prepare(
    `UPDATE documents
     SET nom_document = COALESCE(?, nom_document),
         type_document = COALESCE(?, type_document),
         chemin_fichier = ?,
         file_size = ?,
         version = version + ?,
         date_upload = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    nom_document || null,
    type_document || null,
    newStoredName,
    newSize,
    hasNewFile ? 1 : 0,
    req.params.id
  );

  if (hasNewFile && existing.chemin_fichier && existing.chemin_fichier !== newStoredName) {
    const oldPath = getAbsoluteDocumentPath(existing.chemin_fichier);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        // keep metadata update even if old cleanup fails
      }
    }
  }

  const updated = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  return res.json(updated);
});

router.get("/:id/download", authRequired, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document introuvable" });

  const absPath = getAbsoluteDocumentPath(doc.chemin_fichier);
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ message: "Fichier absent du stockage" });
  }

  const downloadName = `${sanitizeFilename(doc.nom_document) || "document"}-v${doc.version || 1}.pdf`;
  return res.download(absPath, downloadName);
});

router.delete("/:id", authRequired, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document introuvable" });

  db.prepare("DELETE FROM documents WHERE id = ?").run(req.params.id);
  const absPath = getAbsoluteDocumentPath(doc.chemin_fichier);
  if (fs.existsSync(absPath)) {
    try {
      fs.unlinkSync(absPath);
    } catch {
      // metadata already removed; keep API successful
    }
  }

  return res.status(204).send();
});

module.exports = router;
