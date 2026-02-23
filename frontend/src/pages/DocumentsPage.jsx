const officialDocuments = [
  {
    name: "MANEX.pdf",
    title: "MANEX",
    description: "Manuel d'exploitation des operations drones."
  },
  {
    name: "KBIS.pdf",
    title: "KBIS",
    description: "Extrait Kbis de l'entreprise."
  },
  {
    name: "Attestation_assurance.pdf",
    title: "Attestation assurance",
    description: "Attestation d'assurance responsabilite civile professionnelle."
  }
];

export default function DocumentsPage() {
  return (
    <div>
      <div className="page-head">
        <h2>Documents officiels</h2>
      </div>
      <p className="documents-intro">
        Retrouvez ici les documents reglementaires et administratifs de l'entreprise.
      </p>

      <div className="documents-grid">
        {officialDocuments.map((doc) => (
          <article key={doc.name} className="document-card">
            <div className="document-top">
              <span className="pdf-badge" aria-hidden="true">
                PDF
              </span>
              <div>
                <h3>{doc.title}</h3>
                <p>{doc.description}</p>
              </div>
            </div>
            <a
              className="document-download"
              href={`/documents/${doc.name}`}
              download={doc.name}
              target="_blank"
              rel="noreferrer"
            >
              Telecharger
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
