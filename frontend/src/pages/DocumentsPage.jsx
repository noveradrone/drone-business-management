import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

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
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [uploadForm, setUploadForm] = useState({ nom_document: "", file: null });
  const replaceInputRefs = useRef({});

  async function load() {
    try {
      setDocuments(await api.documents.list({ q: query }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const visibleDocuments = useMemo(() => {
    const rows = [...documents];
    if (sortBy === "recent") {
      rows.sort((a, b) => new Date(b.date_upload || 0).getTime() - new Date(a.date_upload || 0).getTime());
    } else if (sortBy === "oldest") {
      rows.sort((a, b) => new Date(a.date_upload || 0).getTime() - new Date(b.date_upload || 0).getTime());
    } else if (sortBy === "name") {
      rows.sort((a, b) => String(a.nom_document || "").localeCompare(String(b.nom_document || ""), "fr"));
    }
    return rows;
  }, [documents, sortBy]);

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
        file_name: uploadForm.file.name,
        file_data_url: dataUrl
      });
      setUploadForm({ nom_document: "", file: null });
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

  function startRename(doc) {
    setEditingId(doc.id);
    setEditingName(doc.nom_document || "");
  }

  async function saveRename(doc) {
    setError("");
    if (!editingName.trim()) {
      setError("Le nom du document est requis.");
      return;
    }
    setSaving(true);
    try {
      await api.documents.replace(doc.id, { nom_document: editingName.trim() });
      setEditingId(null);
      setEditingName("");
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
      <p className="documents-intro">Retrouvez ici les documents reglementaires et administratifs de l'entreprise.</p>

      {error && <p className="error">{error}</p>}

      <form className="form-grid" onSubmit={uploadDocument}>
        <input
          placeholder="Nom du document"
          value={uploadForm.nom_document}
          onChange={(e) => setUploadForm((prev) => ({ ...prev, nom_document: e.target.value }))}
          required
        />
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

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="filter-row">
          <input placeholder="Rechercher par nom" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Plus recents</option>
            <option value="oldest">Plus anciens</option>
            <option value="name">Nom A-Z</option>
          </select>
        </div>
      </div>

      <div className="documents-grid">
        {visibleDocuments.map((doc) => (
          <article key={doc.id} className="document-card">
            <div className="document-top">
              <span className="pdf-badge" aria-hidden="true">PDF</span>
              <div>
                {editingId === doc.id ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="secondary" onClick={() => saveRename(doc)} disabled={saving}>Enregistrer nom</button>
                      <button type="button" className="secondary" onClick={() => setEditingId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>{doc.nom_document}</h3>
                    <p>Upload: {toIsoDate(doc.date_upload)}</p>
                    <p>Taille: {formatBytes(doc.file_size)}</p>
                    <p>Version: v{doc.version || 1}</p>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="document-download" onClick={() => downloadDocument(doc)}>Telecharger</button>
              <button type="button" className="secondary" onClick={() => triggerReplace(doc.id)}>Remplacer</button>
              <button type="button" className="secondary" onClick={() => startRename(doc)}>Renommer</button>
              <button type="button" className="secondary" onClick={() => removeDocument(doc)}>Supprimer</button>
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
