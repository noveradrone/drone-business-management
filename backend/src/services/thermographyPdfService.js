const PDFDocument = require("pdfkit");
const { buildLines, clean, isFilled, formatCompanyBlock } = require("../utils/pdfHelpers");

const PAGE = {
  marginX: 40,
  marginTop: 36,
  marginBottom: 44
};

function decodeDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

async function fetchImageBuffer(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:image/")) return decodeDataUrl(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function createDoc() {
  return new PDFDocument({
    size: "A4",
    margin: PAGE.marginX,
    bufferPages: true
  });
}

function ensureY(doc, y, required) {
  const maxY = doc.page.height - PAGE.marginBottom;
  if (y + required <= maxY) return y;
  doc.addPage();
  return PAGE.marginTop;
}

function drawSectionTitle(doc, y, title) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f3d91").text(title, PAGE.marginX, y);
  return y + 20;
}

function drawLinesBlock(doc, y, lines) {
  let current = y;
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  lines.forEach((line) => {
    current = ensureY(doc, current, 18);
    doc.text(line, PAGE.marginX, current, { width: doc.page.width - PAGE.marginX * 2 });
    current += 14;
  });
  return current + 6;
}

function drawInfoTable(doc, y, rows) {
  let currentY = y;
  const left = PAGE.marginX;
  const width = doc.page.width - PAGE.marginX * 2;
  rows.forEach((row) => {
    const label = clean(row.label);
    const value = clean(row.value);
    if (!isFilled(label) || !isFilled(value)) return;
    currentY = ensureY(doc, currentY, 24);
    doc.roundedRect(left, currentY, width, 22, 6).lineWidth(0.8).stroke("#d8e0ef");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#4b5563").text(label, left + 8, currentY + 7, { width: 160 });
    doc.font("Helvetica").fontSize(10).fillColor("#111827").text(value, left + 172, currentY + 6, { width: width - 180 });
    currentY += 26;
  });
  return currentY + 6;
}

async function drawAnomalyPage(doc, anomaly, index) {
  doc.addPage();
  let y = PAGE.marginTop;
  y = drawSectionTitle(doc, y, `Anomalie ${index + 1} - ${clean(anomaly.titre, "Sans titre")}`);

  y = drawInfoTable(doc, y, [
    { label: "Zone", value: clean(anomaly.zone, "-") },
    { label: "Type", value: clean(anomaly.type_anomalie, "-") },
    { label: "Gravite", value: clean(anomaly.gravite, "-") },
    { label: "Temperature max", value: isFilled(anomaly.temperature_max) ? `${Number(anomaly.temperature_max).toFixed(2)}°C` : "-" },
    { label: "Temperature min", value: isFilled(anomaly.temperature_min) ? `${Number(anomaly.temperature_min).toFixed(2)}°C` : "-" },
    { label: "Ecart thermique", value: isFilled(anomaly.ecart_thermique) ? `${Number(anomaly.ecart_thermique).toFixed(2)}°C` : "-" }
  ]);

  const imageThermique = await fetchImageBuffer(anomaly.image_thermique_url);
  const imageVisible = await fetchImageBuffer(anomaly.image_visible_url);
  const imageWidth = (doc.page.width - PAGE.marginX * 2 - 12) / 2;
  const imageHeight = 180;

  y = ensureY(doc, y, imageHeight + 28);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Image thermique", PAGE.marginX, y);
  doc.text("Image visible", PAGE.marginX + imageWidth + 12, y);
  y += 14;

  if (imageThermique) {
    try {
      doc.image(imageThermique, PAGE.marginX, y, { fit: [imageWidth, imageHeight], align: "center", valign: "center" });
    } catch {
      doc.rect(PAGE.marginX, y, imageWidth, imageHeight).stroke("#d8e0ef");
    }
  } else {
    doc.rect(PAGE.marginX, y, imageWidth, imageHeight).stroke("#d8e0ef");
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Image non disponible", PAGE.marginX + 30, y + 80);
  }

  if (imageVisible) {
    try {
      doc.image(imageVisible, PAGE.marginX + imageWidth + 12, y, {
        fit: [imageWidth, imageHeight],
        align: "center",
        valign: "center"
      });
    } catch {
      doc.rect(PAGE.marginX + imageWidth + 12, y, imageWidth, imageHeight).stroke("#d8e0ef");
    }
  } else {
    doc.rect(PAGE.marginX + imageWidth + 12, y, imageWidth, imageHeight).stroke("#d8e0ef");
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Image non disponible", PAGE.marginX + imageWidth + 42, y + 80);
  }
  y += imageHeight + 16;

  const paragraphs = buildLines([
    anomaly.description_terrain ? `Description terrain: ${anomaly.description_terrain}` : "",
    anomaly.causes_probables ? `Causes probables: ${anomaly.causes_probables}` : "",
    anomaly.risques_potentiels ? `Risques potentiels: ${anomaly.risques_potentiels}` : "",
    anomaly.interpretation_ai ? `Interpretation IA: ${anomaly.interpretation_ai}` : "",
    anomaly.recommandation_ai ? `Recommandation IA: ${anomaly.recommandation_ai}` : ""
  ]);

  paragraphs.forEach((text) => {
    y = ensureY(doc, y, 40);
    const h = doc.heightOfString(text, { width: doc.page.width - PAGE.marginX * 2, lineGap: 2 });
    doc.roundedRect(PAGE.marginX, y, doc.page.width - PAGE.marginX * 2, h + 10, 8).stroke("#e1e7f3");
    doc.font("Helvetica").fontSize(10).fillColor("#111827").text(text, PAGE.marginX + 8, y + 6, {
      width: doc.page.width - PAGE.marginX * 2 - 16,
      lineGap: 2
    });
    y += h + 16;
  });
}

async function buildThermographyPdf({ inspection, anomalies = [], client = {}, company = {} }) {
  const doc = createDoc();
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = PAGE.marginTop;
  const logoBuffer = decodeDataUrl(company.logo_data_url);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE.marginX, y, { fit: [110, 66] });
    } catch {
      // ignore image rendering failure
    }
  }
  doc.font("Helvetica-Bold").fontSize(23).fillColor("#0f3d91").text("Rapport thermographique", PAGE.marginX + 124, y + 6);
  y += 72;

  y = drawInfoTable(doc, y, [
    { label: "Entreprise", value: clean(company.company_name, "-") },
    { label: "Client", value: clean(client.company_name, "-") },
    { label: "Adresse inspection", value: clean(inspection.adresse, "-") },
    { label: "Date inspection", value: clean(inspection.date_inspection, "-") },
    { label: "Type inspection", value: clean(inspection.type_inspection, "-") },
    { label: "Drone utilise", value: clean(inspection.drone_utilise, "-") },
    { label: "Camera thermique", value: clean(inspection.camera_thermique, "-") },
    { label: "Operateur", value: clean(inspection.operateur, "-") }
  ]);

  y = drawSectionTitle(doc, y, "Informations entreprise");
  y = drawLinesBlock(
    doc,
    y,
    buildLines([
      ...formatCompanyBlock(company),
      company.insurance_policy ? `Assurance: ${company.insurance_policy}` : "",
      company.signature_name ? `Signature: ${company.signature_name}` : ""
    ])
  );

  doc.addPage();
  y = PAGE.marginTop;
  y = drawSectionTitle(doc, y, "Introduction");
  y = drawLinesBlock(doc, y, [clean(inspection.introduction_ai, "Introduction non generee.")]);

  y = drawSectionTitle(doc, y, "Methodologie");
  y = drawLinesBlock(doc, y, [clean(inspection.methodologie_ai, "Methodologie non generee.")]);

  y = drawSectionTitle(doc, y, "Conditions d'intervention");
  y = drawInfoTable(doc, y, [
    { label: "Temperature ambiante", value: isFilled(inspection.temperature_ambiante) ? `${Number(inspection.temperature_ambiante).toFixed(2)}°C` : "-" },
    { label: "Meteo", value: clean(inspection.meteo, "-") },
    { label: "Vent", value: clean(inspection.vent, "-") },
    { label: "Objectif mission", value: clean(inspection.objectif_mission, "-") }
  ]);

  if (isFilled(inspection.observations_generales)) {
    y = drawSectionTitle(doc, y, "Observations generales");
    y = drawLinesBlock(doc, y, [clean(inspection.observations_generales)]);
  }

  for (let i = 0; i < anomalies.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await drawAnomalyPage(doc, anomalies[i], i);
  }

  doc.addPage();
  y = PAGE.marginTop;
  y = drawSectionTitle(doc, y, "Conclusion");
  y = drawLinesBlock(doc, y, [clean(inspection.conclusion_ai, "Conclusion non generee.")]);
  y = drawSectionTitle(doc, y, "Recommandations globales");
  y = drawLinesBlock(
    doc,
    y,
    [clean(inspection.recommandations_globales_ai, "Une verification complementaire est recommandee.")]
  );

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - PAGE.marginBottom + 10;
    doc.font("Helvetica").fontSize(8).fillColor("#6b7280");
    doc.text(`Page ${i + 1}/${pageCount}`, PAGE.marginX, footerY, {
      width: doc.page.width - PAGE.marginX * 2,
      align: "right"
    });
  }

  doc.end();
  return done;
}

module.exports = {
  buildThermographyPdf
};
