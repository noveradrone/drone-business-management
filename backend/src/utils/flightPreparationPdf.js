const PDFDocument = require("pdfkit");
const { buildLines, clean, formatCompanyBlock, isFilled } = require("./pdfHelpers");

function boolLabel(value) {
  return value ? "Oui" : "Non";
}

function drawTitle(doc, text, y) {
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#10223d").text(text, 40, y);
  return y + 24;
}

function drawSubTitle(doc, text, y) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#163b71").text(text, 40, y);
  return y + 16;
}

function ensureSpace(doc, y, needed) {
  const limit = doc.page.height - 56;
  if (y + needed <= limit) return y;
  doc.addPage();
  return 44;
}

function drawLines(doc, y, lines = [], options = {}) {
  const size = options.size || 10;
  const lineGap = options.lineGap || 3;
  doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(options.color || "#1e293b");
  let cursor = y;
  lines.forEach((line) => {
    if (!isFilled(line)) return;
    const text = String(line);
    const h = doc.heightOfString(text, { width: options.width || 520, lineGap });
    cursor = ensureSpace(doc, cursor, h + 6);
    doc.text(text, options.x || 40, cursor, { width: options.width || 520, lineGap });
    cursor += h + 4;
  });
  return cursor;
}

function drawChecklist(doc, y, checklist = []) {
  y = drawSubTitle(doc, "Checklist dynamique", y);
  checklist.forEach((item) => {
    const status = item.state === "done" ? "[x]" : "[ ]";
    const line = `${status} ${clean(item.label)}`;
    y = ensureSpace(doc, y, 26);
    doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(line, 48, y, { width: 510 });
    y += 13;
    if (isFilled(item.description)) {
      doc.font("Helvetica").fontSize(9).fillColor("#5b6473").text(String(item.description), 60, y, { width: 500 });
      y += 12;
    }
    if (isFilled(item.link_url)) {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#1f4a8a").text(String(item.link_url), 60, y, { width: 500 });
      y += 10;
    }
    y += 5;
  });
  return y + 6;
}

async function buildFlightPreparationPackPdf(payload = {}) {
  const {
    mission = {},
    preparation = {},
    recommendation = {},
    checklist = [],
    attachments = [],
    company = {}
  } = payload;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40
  });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const endPromise = new Promise((resolve) => doc.on("end", resolve));

  let y = 42;
  y = drawTitle(doc, "Dossier Mission - Preparation de Vol", y);

  const companyLines = formatCompanyBlock(company);
  const left = buildLines([
    companyLines[0],
    companyLines[1],
    companyLines[2],
    companyLines[3]
  ]);
  const right = buildLines([
    `Mission: #${mission.id || "-"}`,
    mission.mission_date ? `Date mission: ${mission.mission_date}` : "",
    mission.company_name ? `Client: ${mission.company_name}` : "",
    mission.location ? `Lieu mission: ${mission.location}` : ""
  ]);

  doc.roundedRect(40, y, 250, 86, 8).lineWidth(1).stroke("#d8e0ef");
  doc.roundedRect(304, y, 250, 86, 8).lineWidth(1).stroke("#d8e0ef");
  drawLines(doc, y + 10, left, { x: 50, width: 230, size: 9 });
  drawLines(doc, y + 10, right, { x: 314, width: 230, size: 9 });
  y += 96;

  y = drawSubTitle(doc, "Categorie & Parametres", y);
  y = drawLines(
    doc,
    y,
    buildLines([
      `Categorie: ${preparation.category_type || "A verifier"}`,
      preparation.open_subcategory ? `Sous-categorie ouverte: ${preparation.open_subcategory}` : "",
      preparation.specific_type ? `Type specifique: ${preparation.specific_type}` : "",
      preparation.pdra_type ? `PDRA: ${preparation.pdra_type}` : "",
      preparation.location_address ? `Adresse operation: ${preparation.location_address}` : "",
      preparation.operation_date ? `Date operation: ${preparation.operation_date}` : "",
      buildLines([preparation.start_time ? `Debut ${preparation.start_time}` : "", preparation.end_time ? `Fin ${preparation.end_time}` : ""]).join(" | "),
      preparation.altitude_max_m !== null && preparation.altitude_max_m !== undefined ? `Altitude max: ${preparation.altitude_max_m} m` : "",
      `Zone urbaine: ${boolLabel(Boolean(preparation.in_urban_area))}`,
      `Operation de nuit: ${boolLabel(Boolean(preparation.night_operation))}`,
      `Proximite aeroport/CTR: ${boolLabel(Boolean(preparation.near_airport_or_ctr))}${preparation.near_airport_details ? ` (${preparation.near_airport_details})` : ""}`,
      `Zone restreinte: ${boolLabel(Boolean(preparation.restricted_zone))}${preparation.restricted_zone_details ? ` (${preparation.restricted_zone_details})` : ""}`,
      `Drone: ${clean(preparation.aircraft_class) || "N/A"} | MTOM: ${isFilled(preparation.mtom_kg) ? `${preparation.mtom_kg} kg` : "N/A"}`
    ]),
    { size: 9.6, lineGap: 2 }
  );
  y += 6;

  y = drawSubTitle(doc, "Obligations guidees (non juridiques)", y);
  y = drawLines(
    doc,
    y,
    (recommendation.obligations || []).map((o) => `${String(o.level || "").toUpperCase()}: ${o.text}`),
    { size: 9.4 }
  );

  y = drawChecklist(doc, y + 2, checklist || []);

  y = drawSubTitle(doc, "Statuts demarches", y);
  y = drawLines(
    doc,
    y,
    buildLines([
      `FlyBy: ${clean(preparation.flyby_status) || "todo"}`,
      `AlphaTango: ${clean(preparation.alphatango_status) || "todo"}`,
      `Mairie: ${clean(preparation.municipality_status) || "todo"}`,
      `Proprietaire terrain: ${clean(preparation.landowner_status) || "todo"}`,
      `Autorites militaires: ${clean(preparation.military_status) || "todo"}`
    ]),
    { size: 9.6 }
  );
  y += 4;

  if (attachments.length) {
    y = drawSubTitle(doc, "Pieces jointes / preuves", y);
    y = drawLines(
      doc,
      y,
      attachments.map((a) => `${a.original_name} (${Number(a.file_size || 0)} octets)`),
      { size: 8.8 }
    );
  }

  y = ensureSpace(doc, y, 42);
  doc.moveTo(40, y + 6).lineTo(555, y + 6).strokeColor("#d8e0ef").stroke();
  const footerLines = buildLines([
    recommendation.notes?.[0],
    recommendation.notes?.[1],
    company.payment_terms ? `Conditions: ${company.payment_terms}` : ""
  ]);
  drawLines(doc, y + 12, footerLines, { size: 8.5, color: "#5b6473" });

  doc.end();
  await endPromise;
  return Buffer.concat(chunks);
}

module.exports = {
  buildFlightPreparationPackPdf
};
