const PDFDocument = require("pdfkit");
const { buildLines, clean, isFilled, formatCompanyBlock, formatClientBlock } = require("../utils/pdfHelpers");

const PAGE = {
  marginX: 42,
  marginTop: 44,
  marginBottom: 46
};

const COLORS = {
  heading: "#0f3d91",
  border: "#d7e2f1",
  softBg: "#f6f9ff",
  text: "#111827",
  muted: "#4b5563"
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

function maxY(doc) {
  return doc.page.height - PAGE.marginBottom;
}

function ensureSpace(doc, y, required) {
  if (y + required <= maxY(doc)) return y;
  doc.addPage();
  return PAGE.marginTop;
}

function sectionTitle(doc, y, title, minFollowingHeight = 52) {
  y = ensureSpace(doc, y, 24 + minFollowingHeight);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.heading).text(title, PAGE.marginX, y);
  return y + 24;
}

function paragraphBlock(doc, y, title, value, options = {}) {
  const text = clean(value);
  if (!text) return y;

  const width = options.width || doc.page.width - PAGE.marginX * 2;
  const x = options.x || PAGE.marginX;
  const labelHeight = title ? 16 : 0;
  const textHeight = doc.heightOfString(text, { width: width - 18, lineGap: 2 });
  const boxHeight = labelHeight + textHeight + 14;
  y = ensureSpace(doc, y, boxHeight + 8);

  doc.roundedRect(x, y, width, boxHeight, 10).lineWidth(0.8).strokeColor(COLORS.border).fillAndStroke("#ffffff", COLORS.border);

  let currentY = y + 8;
  if (title) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(title.toUpperCase(), x + 9, currentY, {
      width: width - 18
    });
    currentY += 13;
  }

  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text).text(text, x + 9, currentY, {
    width: width - 18,
    lineGap: 2
  });

  return y + boxHeight + 8;
}

function keyValueGrid(doc, y, rows, options = {}) {
  const x = options.x || PAGE.marginX;
  const width = options.width || doc.page.width - PAGE.marginX * 2;
  const labelWidth = options.labelWidth || 180;
  const rowHeight = options.rowHeight || 24;

  rows.forEach((row) => {
    const label = clean(row.label);
    const value = clean(row.value);
    if (!isFilled(label) || !isFilled(value)) return;
    y = ensureSpace(doc, y, rowHeight + 2);

    doc.roundedRect(x, y, width, rowHeight, 7).lineWidth(0.8).strokeColor(COLORS.border).fillAndStroke(COLORS.softBg, COLORS.border);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(label, x + 8, y + 8, { width: labelWidth - 10 });
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text).text(value, x + labelWidth, y + 7, {
      width: width - labelWidth - 8,
      align: "left"
    });
    y += rowHeight + 4;
  });

  return y + 4;
}

function drawImagePlaceholder(doc, x, y, width, height, label) {
  doc.roundedRect(x, y, width, height, 8).lineWidth(0.8).strokeColor(COLORS.border).stroke();
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(label, x, y + height / 2 - 5, {
    width,
    align: "center"
  });
}

async function drawImageCard(doc, y, imageUrl, title, legend) {
  const x = PAGE.marginX;
  const width = doc.page.width - PAGE.marginX * 2;
  const imageHeight = 220;
  const rawLegend = clean(legend);
  const legendText = rawLegend.length > 900 ? `${rawLegend.slice(0, 900)}...` : rawLegend;
  const titleText = clean(title, "Illustration");
  const legendHeight = legendText ? Math.min(doc.heightOfString(legendText, { width: width - 18, lineGap: 2 }), 92) : 0;
  const total = imageHeight + 54 + legendHeight;

  y = ensureSpace(doc, y, total + 10);
  doc.roundedRect(x, y, width, total, 10).lineWidth(0.8).strokeColor(COLORS.border).fillAndStroke("#ffffff", COLORS.border);

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text).text(titleText, x + 10, y + 10, { width: width - 20 });

  const imageY = y + 30;
  const imageBuffer = await fetchImageBuffer(imageUrl);
  if (imageBuffer) {
    try {
      doc.image(imageBuffer, x + 10, imageY, { fit: [width - 20, imageHeight], align: "center", valign: "center" });
    } catch {
      drawImagePlaceholder(doc, x + 10, imageY, width - 20, imageHeight, "Image non exploitable");
    }
  } else {
    drawImagePlaceholder(doc, x + 10, imageY, width - 20, imageHeight, "Image non disponible");
  }

  if (legendText) {
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted).text(legendText, x + 10, imageY + imageHeight + 10, {
      width: width - 20,
      lineGap: 2
    });
  }

  return y + total + 10;
}

async function drawCoverPage(doc, { inspection, client, company }) {
  let y = PAGE.marginTop;
  const pageWidth = doc.page.width - PAGE.marginX * 2;

  const logoBuffer = decodeDataUrl(company.logo_data_url);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE.marginX, y, { fit: [128, 86], align: "left", valign: "top" });
    } catch {
      // ignore
    }
  }

  doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.heading).text("RAPPORT THERMOGRAPHIQUE", PAGE.marginX + 140, y + 8, {
    width: pageWidth - 140,
    align: "left"
  });
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(`Date de generation: ${new Date().toLocaleDateString("fr-FR")}`, PAGE.marginX + 140, y + 42);
  y += 98;

  const leftColX = PAGE.marginX;
  const rightColX = PAGE.marginX + pageWidth / 2 + 8;
  const colWidth = pageWidth / 2 - 8;

  const companyLines = buildLines([
    ...formatCompanyBlock(company),
    company.insurance_policy ? `Assurance: ${company.insurance_policy}` : "",
    company.signature_name ? `Signataire: ${company.signature_name}` : ""
  ]);

  const clientLines = buildLines([
    ...formatClientBlock(client),
    inspection.adresse ? `Site inspecte: ${inspection.adresse}` : ""
  ]);

  const companyHeight = Math.max(70, companyLines.length * 14 + 30);
  const clientHeight = Math.max(70, clientLines.length * 14 + 30);
  const headerHeight = Math.max(companyHeight, clientHeight);

  doc.roundedRect(leftColX, y, colWidth, headerHeight, 10).lineWidth(0.8).strokeColor(COLORS.border).fillAndStroke("#ffffff", COLORS.border);
  doc.roundedRect(rightColX, y, colWidth, headerHeight, 10).lineWidth(0.8).strokeColor(COLORS.border).fillAndStroke("#ffffff", COLORS.border);

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.heading).text("Entreprise", leftColX + 10, y + 10);
  doc.font("Helvetica").fontSize(9.8).fillColor(COLORS.text).text(companyLines.join("\n") || "Informations non renseignees", leftColX + 10, y + 25, {
    width: colWidth - 20,
    lineGap: 2
  });

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.heading).text("Client / Destinataire", rightColX + 10, y + 10);
  doc.font("Helvetica").fontSize(9.8).fillColor(COLORS.text).text(clientLines.join("\n") || "Informations non renseignees", rightColX + 10, y + 25, {
    width: colWidth - 20,
    lineGap: 2
  });

  y += headerHeight + 16;

  y = keyValueGrid(doc, y, [
    { label: "Titre mission", value: clean(inspection.titre, "-") },
    { label: "Date inspection", value: clean(inspection.date_inspection, "-") },
    { label: "Type inspection", value: clean(inspection.type_inspection, "-") },
    { label: "Drone utilise", value: clean(inspection.drone_utilise, "-") },
    { label: "Camera thermique", value: clean(inspection.camera_thermique, "-") },
    { label: "Operateur", value: clean(inspection.operateur, "-") }
  ]);

  y = paragraphBlock(doc, y, "Objectif de mission", inspection.objectif_mission || "Objectif non precise.");
  paragraphBlock(
    doc,
    y,
    "Observations preliminaires",
    inspection.observations_generales || "Aucune observation generale renseignee."
  );
}

async function drawContextPage(doc, { inspection, reportImages = [] }) {
  doc.addPage();
  let y = PAGE.marginTop;

  y = sectionTitle(doc, y, "Contexte et methodologie");
  y = paragraphBlock(
    doc,
    y,
    "Perimetre de mission",
    [
      clean(inspection.objectif_mission, "Objectif non renseigne."),
      clean(inspection.adresse) ? `Site inspecte: ${clean(inspection.adresse)}.` : "",
      clean(inspection.type_inspection) ? `Type d'inspection: ${clean(inspection.type_inspection)}.` : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
  y = paragraphBlock(doc, y, "Introduction", clean(inspection.introduction_ai, "Introduction non generee."));
  y = paragraphBlock(doc, y, "Methodologie", clean(inspection.methodologie_ai, "Methodologie non generee."));

  y = sectionTitle(doc, y, "Conditions d'intervention");
  y = keyValueGrid(doc, y, [
    {
      label: "Temperature ambiante",
      value: isFilled(inspection.temperature_ambiante) ? `${Number(inspection.temperature_ambiante).toFixed(1)} degC` : "-"
    },
    { label: "Meteo", value: clean(inspection.meteo, "-") },
    { label: "Vent", value: clean(inspection.vent, "-") },
    { label: "Objectif mission", value: clean(inspection.objectif_mission, "-") }
  ]);

  y = paragraphBlock(
    doc,
    y,
    "Limites et precautions d'interpretation",
    "L'interpretation thermique reste dependante des conditions d'acquisition, de l'emissivite des materiaux, " +
      "de l'environnement (meteo/vent) et de l'angle de prise de vue. Selon les bonnes pratiques d'inspection thermographique, " +
      "un controle complementaire de terrain peut etre necessaire pour confirmer les observations."
  );

  if (reportImages.length) {
    y = sectionTitle(doc, y, "Illustrations complementaires (selection)");
    for (let i = 0; i < Math.min(reportImages.length, 2); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      y = await drawImageCard(doc, y, reportImages[i].image_url, reportImages[i].titre, reportImages[i].legende);
    }
  }
}

function parseInterpretationSections(text) {
  const raw = clean(text);
  const result = {
    observation: "",
    interpretation: "",
    hypotheses: "",
    vigilance: "",
    fallback: raw
  };
  if (!raw) return result;

  raw
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean)
    .forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.startsWith("observation visuelle:")) {
        result.observation = clean(line.split(":").slice(1).join(":"));
      } else if (lower.startsWith("interpretation thermique:")) {
        result.interpretation = clean(line.split(":").slice(1).join(":"));
      } else if (lower.startsWith("hypotheses possibles:")) {
        result.hypotheses = clean(line.split(":").slice(1).join(":"));
      } else if (lower.startsWith("niveau de vigilance:")) {
        result.vigilance = clean(line.split(":").slice(1).join(":"));
      }
    });

  return result;
}

async function drawAnomalyPage(doc, anomaly, index) {
  doc.addPage();
  let y = PAGE.marginTop;
  y = sectionTitle(doc, y, `Observation / anomalie ${index + 1}`);
  y = paragraphBlock(doc, y, "Titre", clean(anomaly.titre, "Sans titre"));

  y = keyValueGrid(doc, y, [
    { label: "Zone", value: clean(anomaly.zone, "-") },
    { label: "Type anomalie", value: clean(anomaly.type_anomalie, "-") },
    {
      label: "Temperature max",
      value: isFilled(anomaly.temperature_max) ? `${Number(anomaly.temperature_max).toFixed(1)} degC` : "-"
    },
    {
      label: "Temperature min",
      value: isFilled(anomaly.temperature_min) ? `${Number(anomaly.temperature_min).toFixed(1)} degC` : "-"
    },
    {
      label: "Ecart thermique",
      value: isFilled(anomaly.ecart_thermique) ? `${Number(anomaly.ecart_thermique).toFixed(1)} degC` : "-"
    },
    { label: "Gravite", value: clean(anomaly.gravite, "-") }
  ]);

  const pairHeight = 210;
  const gap = 12;
  const width = (doc.page.width - PAGE.marginX * 2 - gap) / 2;

  y = ensureSpace(doc, y, pairHeight + 42);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.heading).text("Image thermique", PAGE.marginX, y);
  doc.text("Image visible", PAGE.marginX + width + gap, y);
  y += 16;

  const thermBuffer = await fetchImageBuffer(anomaly.image_thermique_url);
  if (thermBuffer) {
    try {
      doc.image(thermBuffer, PAGE.marginX, y, { fit: [width, pairHeight], align: "center", valign: "center" });
    } catch {
      drawImagePlaceholder(doc, PAGE.marginX, y, width, pairHeight, "Image thermique non exploitable");
    }
  } else {
    drawImagePlaceholder(doc, PAGE.marginX, y, width, pairHeight, "Image thermique non disponible");
  }

  const visibleBuffer = await fetchImageBuffer(anomaly.image_visible_url);
  if (visibleBuffer) {
    try {
      doc.image(visibleBuffer, PAGE.marginX + width + gap, y, {
        fit: [width, pairHeight],
        align: "center",
        valign: "center"
      });
    } catch {
      drawImagePlaceholder(doc, PAGE.marginX + width + gap, y, width, pairHeight, "Image visible non exploitable");
    }
  } else {
    drawImagePlaceholder(doc, PAGE.marginX + width + gap, y, width, pairHeight, "Image visible non disponible");
  }
  y += pairHeight + 12;

  const interpretationSections = parseInterpretationSections(anomaly.interpretation_ai);

  y = paragraphBlock(doc, y, "Description terrain", anomaly.description_terrain);
  y = paragraphBlock(doc, y, "Observation visuelle", interpretationSections.observation);
  y = paragraphBlock(
    doc,
    y,
    "Interpretation thermique",
    clean(interpretationSections.interpretation, interpretationSections.fallback)
  );
  y = paragraphBlock(doc, y, "Hypotheses possibles", clean(interpretationSections.hypotheses, anomaly.causes_probables));
  y = paragraphBlock(doc, y, "Niveau de vigilance", interpretationSections.vigilance);
  y = paragraphBlock(doc, y, "Recommandation IA", anomaly.recommandation_ai);
  y = paragraphBlock(doc, y, "Causes probables", anomaly.causes_probables);
  y = paragraphBlock(doc, y, "Risques potentiels", anomaly.risques_potentiels);
  paragraphBlock(doc, y, "Verification recommandee", anomaly.verification_recommandee);
}

async function drawSupplementaryImagesPages(doc, reportImages = []) {
  if (!reportImages.length) return;
  doc.addPage();
  let y = PAGE.marginTop;
  y = sectionTitle(doc, y, "Annexes - illustrations complementaires");

  for (let i = 0; i < reportImages.length; i += 1) {
    const item = reportImages[i];
    // eslint-disable-next-line no-await-in-loop
    y = await drawImageCard(doc, y, item.image_url, item.titre || `Illustration ${i + 1}`, item.legende);
  }
}

async function drawFinalPage(doc, { inspection }) {
  doc.addPage();
  let y = PAGE.marginTop;

  y = sectionTitle(doc, y, "Synthese generale");
  y = paragraphBlock(doc, y, "Synthese", clean(inspection.conclusion_ai, "Conclusion non generee."));

  y = sectionTitle(doc, y, "Recommandations globales");
  y = paragraphBlock(
    doc,
    y,
    "Actions recommandees",
    clean(inspection.recommandations_globales_ai, "Une verification complementaire est recommandee.")
  );

  y = sectionTitle(doc, y, "Limites d'interpretation");
  y = paragraphBlock(
    doc,
    y,
    "Note professionnelle",
    "Les observations thermiques de ce document doivent etre interpretees avec prudence. " +
      "Ce rapport ne constitue pas a lui seul un diagnostic destructif ou definitif. " +
      "Les constats doivent etre recoupes avec des controles complementaires sur site si necessaire."
  );

  y = sectionTitle(doc, y, "References et bonnes pratiques");
  paragraphBlock(
    doc,
    y,
    "Cadre general",
    "Ce rapport suit une demarche d'observation thermographique aerienne orientee prevention et aide a la decision. " +
      "Selon les bonnes pratiques d'inspection thermographique, l'interpretation reste dependante des conditions d'acquisition " +
      "et des verifications de terrain complementaires."
  );
}

async function buildThermographyPdf({ inspection, anomalies = [], reportImages = [], client = {}, company = {} }) {
  const doc = createDoc();
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  await drawCoverPage(doc, { inspection, client, company });
  await drawContextPage(doc, { inspection, reportImages });

  for (let i = 0; i < anomalies.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await drawAnomalyPage(doc, anomalies[i], i);
  }

  await drawSupplementaryImagesPages(doc, reportImages);
  await drawFinalPage(doc, { inspection });

  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  for (let i = 0; i < pageCount; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - PAGE.marginBottom + 16;
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(`Page ${i + 1}/${pageCount}`, PAGE.marginX, footerY, {
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
