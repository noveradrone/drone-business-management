import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const typeOptions = ["MANEX", "KBIS", "Assurance", "Autre"];

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function toIsoDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("fr-FR");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    nom_document: "",
    type_document: "Autre",
    file: null
  });
  const replaceInputRefs = useRef({});

  async function load() {
    try {
      setDocuments(await api.documents.list());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadDocument(e) {
    e.preventDefault();
    setError("");
    if (!uploadForm.file) {
      setError("Selectionne un PDF a importer.");
      return;
    }
    if (uploadForm.file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptes.");
      return;
    }

    setSaving(true);
    try {
      const dataUrl = await fileToDataUrl(uploadForm.file);
      await api.documents.upload({
        nom_document: uploadForm.nom_document || uploadForm.file.name.replace(/\.pdf$/i, ""),
        type_document: uploadForm.type_document,
        file_name: uploadForm.file.name,
        file_data_url: dataUrl
      });
      setUploadForm({ nom_document: "", type_document: "Autre", file: null });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocument(doc) {
    setError("");
    try {
      const blob = await api.documents.download(doc.id);
      downloadBlob(blob, `${doc.nom_document}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeDocument(doc) {
    if (!window.confirm(`Supprimer le document "${doc.nom_document}" ?`)) return;
    setError("");
    try {
      await api.documents.remove(doc.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function triggerReplace(docId) {
    replaceInputRefs.current[docId]?.click();
  }

  async function replaceDocument(doc, file) {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptes.");
      return;
    }

    setSaving(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await api.documents.replace(doc.id, {
        nom_document: doc.nom_document,
        type_document: doc.type_document,
        file_name: file.name,
        file_data_url: dataUrl
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="documents-page">
      <div className="page-head">
        <h2>Documents officiels</h2>
      </div>
      <p className="documents-intro">
        Retrouvez ici les documents reglementaires et administratifs de l'entreprise.
      </p>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={uploadDocument}>
        <input
          placeholder="Nom du document"
          value={uploadForm.nom_document}
          onChange={(e) => setUploadForm((prev) => ({ ...prev, nom_document: e.target.value }))}
          required
        />
        <select
          value={uploadForm.type_document}
          onChange={(e) => setUploadForm((prev) => ({ ...prev, type_document: e.target.value }))}
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setUploadForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
          required
        />
        <button className="primary-action" style={{ gridColumn: "1 / -1" }} disabled={saving}>
          {saving ? "Import..." : "Importer un document"}
        </button>
      </form>

      <div className="documents-grid">
        {documents.map((doc) => (
          <article key={doc.id} className="document-card">
            <div className="document-top">
              <span className="pdf-badge" aria-hidden="true">
                PDF
              </span>
              <div>
                <h3>{doc.nom_document}</h3>
                <p>Type: {doc.type_document || "Autre"}</p>
                <p>Upload: {toIsoDate(doc.date_upload)}</p>
                <p>Taille: {formatBytes(doc.file_size)}</p>
                <p>Version: v{doc.version || 1}</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="document-download" onClick={() => downloadDocument(doc)}>
                Telecharger
              </button>
              <button type="button" className="secondary" onClick={() => triggerReplace(doc.id)}>
                Remplacer
              </button>
              <button type="button" className="secondary" onClick={() => removeDocument(doc)}>
                Supprimer
              </button>
              <input
                ref={(el) => {
                  replaceInputRefs.current[doc.id] = el;
                }}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={(e) => replaceDocument(doc, e.target.files?.[0] || null)}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
