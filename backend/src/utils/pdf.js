const PDFDocument = require("pdfkit");
const {
  isFilled,
  clean,
  buildLines,
  joinFilled,
  formatCompanyBlock,
  formatClientBlock
} = require("./pdfHelpers");

const PAGE = {
  marginX: 40,
  marginTop: 34,
  marginBottom: 46
};

function moneyFr(value, currency = "EUR") {
  const n = Number(value || 0);
  const amount = n.toFixed(2).replace(".", ",");
  return `${amount} ${currency || "EUR"}`;
}

function decodeDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch (error) {
    return null;
  }
}

function createDocument() {
  return new PDFDocument({
    size: "A4",
    margin: PAGE.marginX,
    bufferPages: true
  });
}

function ensurePageSpace(doc, y, required) {
  const maxY = doc.page.height - PAGE.marginBottom;
  if (y + required <= maxY) return y;
  doc.addPage();
  return PAGE.marginTop;
}

function drawRoundedBlock(doc, x, y, w, h, title, lines) {
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).stroke("#d8e0ef");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f3d91").text(title, x + 10, y + 10, { width: w - 20 });
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  let lineY = y + 28;
  lines.forEach((line) => {
    doc.text(line, x + 10, lineY, { width: w - 20 });
    lineY += 15;
  });
}

function drawTitleBand(doc, y, typeLabel, number) {
  const left = PAGE.marginX;
  const right = doc.page.width - PAGE.marginX;
  const width = right - left;
  doc.roundedRect(left, y, width, 44, 10).fillAndStroke("#f5f8ff", "#d8e0ef");
  doc.fillColor("#0f3d91").font("Helvetica-Bold").fontSize(18).text(typeLabel, left + 14, y + 12);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text(number || "-", left + 200, y + 14, {
    width: width - 214,
    align: "right"
  });
  return y + 56;
}

function drawHeader(doc, options) {
  const {
    typeLabel,
    number,
    logoDataUrl,
    companyLines,
    clientLines,
    metaLines,
    paymentLines
  } = options;

  const left = PAGE.marginX;
  const right = doc.page.width - PAGE.marginX;
  const width = right - left;
  const topY = PAGE.marginTop;
  const logoW = 110;
  const logoH = 78;
  const logo = decodeDataUrl(logoDataUrl);
  const companyX = left + logoW + 18;
  const companyW = right - companyX;

  if (logo) {
    try {
      doc.image(logo, left, topY, { fit: [logoW, logoH], align: "left", valign: "top" });
    } catch (error) {
      doc.roundedRect(left, topY, logoW, logoH, 6).stroke("#d8e0ef");
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("LOGO", left + 40, topY + 34);
    }
  } else {
    doc.roundedRect(left, topY, logoW, logoH, 6).stroke("#d8e0ef");
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("LOGO", left + 40, topY + 34);
  }

  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(companyLines[0] || "Entreprise", companyX, topY + 2, {
    width: companyW
  });
  doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
  let compY = topY + 22;
  companyLines.slice(1).forEach((line) => {
    doc.text(line, companyX, compY, { width: companyW });
    compY += 14;
  });

  let y = drawTitleBand(doc, Math.max(topY + logoH + 10, compY + 10), typeLabel, number);
  const colGap = 12;
  const colW = (width - colGap) / 2;
  const leftBlockLines = clientLines.length ? clientLines : ["Client non renseigné"];
  const rightLines = buildLines([...metaLines, ...paymentLines]);
  const rightBlockLines = rightLines.length ? rightLines : ["Informations non renseignées"];
  const leftHeight = 28 + leftBlockLines.length * 15 + 10;
  const rightHeight = 28 + rightBlockLines.length * 15 + 10;
  const blockHeight = Math.max(leftHeight, rightHeight, 96);

  drawRoundedBlock(doc, left, y, colW, blockHeight, "DESTINATAIRE", leftBlockLines);
  drawRoundedBlock(doc, left + colW + colGap, y, colW, blockHeight, "INFORMATIONS", rightBlockLines);
  return y + blockHeight + 16;
}

function drawTableHeader(doc, y, columns) {
  const left = PAGE.marginX;
  const right = doc.page.width - PAGE.marginX;
  const width = right - left;
  doc.rect(left, y, width, 24).fillAndStroke("#f8fbff", "#d8e0ef");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9.8);
  columns.forEach((col) => {
    doc.text(col.label, col.x + 6, y + 7, { width: col.w - 12, align: col.align || "left" });
  });
  return y + 24;
}

function drawItemsTable(doc, items, options = {}) {
  const left = PAGE.marginX;
  const right = doc.page.width - PAGE.marginX;
  const width = right - left;
  const showVat = options.showVat !== false;
  let y = options.startY || PAGE.marginTop;
  const taxRate = Number(options.taxRate || 0);

  const widths = showVat
    ? [0.44, 0.12, 0.14, 0.14, 0.16]
    : [0.54, 0.12, 0.17, 0.17];
  const labels = showVat
    ? ["DESIGNATION", "QTE", "PU HT", "TOTAL HT", "TVA"]
    : ["DESIGNATION", "QTE", "PU HT", "TOTAL HT"];

  const columns = [];
  let cursor = left;
  widths.forEach((ratio, idx) => {
    const colWidth = width * ratio;
    columns.push({ label: labels[idx], x: cursor, w: colWidth, align: idx === 0 ? "left" : "right" });
    cursor += colWidth;
  });

  y = ensurePageSpace(doc, y, 36);
  y = drawTableHeader(doc, y, columns);

  const dataRows = Array.isArray(items) && items.length ? items : [];
  doc.font("Helvetica").fontSize(9.8).fillColor("#111827");

  if (!dataRows.length) {
    doc.text("Aucune ligne.", left + 8, y + 8);
    y += 26;
    return { y, taxRate };
  }

  dataRows.forEach((item) => {
    const desc = clean(item.description, "-");
    const qty = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const lineTotal = Number(item.total || qty * unitPrice);
    const vatText = showVat ? `${moneyFr((lineTotal * taxRate) / 100, options.currency)} (${taxRate.toFixed(0)}%)` : "";
    const descHeight = doc.heightOfString(desc, { width: columns[0].w - 12 });
    const rowHeight = Math.max(20, descHeight + 6);

    y = ensurePageSpace(doc, y, rowHeight + 6);
    if (y === PAGE.marginTop) {
      y = drawTableHeader(doc, y, columns);
      doc.font("Helvetica").fontSize(9.8).fillColor("#111827");
    }

    doc.text(desc, columns[0].x + 6, y + 3, { width: columns[0].w - 12 });
    doc.text(qty.toFixed(2), columns[1].x + 6, y + 3, { width: columns[1].w - 12, align: "right" });
    doc.text(moneyFr(unitPrice, options.currency), columns[2].x + 6, y + 3, {
      width: columns[2].w - 12,
      align: "right"
    });
    doc.text(moneyFr(lineTotal, options.currency), columns[3].x + 6, y + 3, {
      width: columns[3].w - 12,
      align: "right"
    });
    if (showVat) {
      doc.text(vatText, columns[4].x + 6, y + 3, { width: columns[4].w - 12, align: "right" });
    }

    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e6edf8").stroke();
  });

  return { y: y + 10, taxRate };
}

function drawTotals(doc, y, totals, options = {}) {
  const right = doc.page.width - PAGE.marginX;
  const currency = options.currency || "EUR";
  const showVat = options.showVat !== false && Number(options.taxRate || 0) > 0;

  const lines = [];
  lines.push({ label: "Sous-total HT", value: moneyFr(totals.subtotal, currency) });
  if (Number(totals.discountAmount || 0) > 0) {
    lines.push({ label: "Remise", value: `-${moneyFr(totals.discountAmount, currency)}` });
  }
  if (showVat) {
    lines.push({
      label: `TVA (${Number(options.taxRate || 0).toFixed(2)}%)`,
      value: moneyFr(totals.taxAmount, currency)
    });
  }
  lines.push({ label: "Total TTC", value: moneyFr(totals.total, currency), strong: true });
  if (Number(totals.acompteAmount || 0) > 0) {
    lines.push({ label: "Acompte", value: moneyFr(totals.acompteAmount, currency) });
    lines.push({ label: "Solde restant", value: moneyFr(totals.balance, currency), strong: true });
  }

  const boxW = 250;
  const lineH = 18;
  const boxH = 14 + lines.length * lineH + 8;
  y = ensurePageSpace(doc, y, boxH + 10);

  const x = right - boxW;
  doc.roundedRect(x, y, boxW, boxH, 8).lineWidth(1).stroke("#d8e0ef");
  let lineY = y + 10;
  lines.forEach((line) => {
    doc.font(line.strong ? "Helvetica-Bold" : "Helvetica").fontSize(line.strong ? 10.8 : 10).fillColor("#111827");
    doc.text(line.label, x + 10, lineY, { width: 120 });
    doc.text(line.value, x + 122, lineY, { width: boxW - 132, align: "right" });
    lineY += lineH;
  });
  return y + boxH + 10;
}

function drawFooterText(doc, y, footerLines) {
  const left = PAGE.marginX;
  const right = doc.page.width - PAGE.marginX;
  const width = right - left;
  const lines = buildLines(footerLines);
  if (!lines.length) return y;
  const needed = lines.length * 12 + 6;
  y = ensurePageSpace(doc, y, needed);
  doc.font("Helvetica").fontSize(8.6).fillColor("#4b5563");
  let lineY = y;
  lines.forEach((line) => {
    doc.text(line, left, lineY, { width });
    lineY += 12;
  });
  return lineY + 3;
}

function applyPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 28;
    doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280").text(`Page ${i + 1}/${total}`, 0, y, {
      align: "right"
    });
  }
}

function finalize(doc) {
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function computeTotalsFromInvoice(invoice) {
  const subtotal = Number(invoice.subtotal || 0);
  const taxRate = Number(invoice.tax_rate || 0);
  const total = Number(invoice.total || 0);
  const taxAmount = Math.max(0, total - subtotal);
  const acompteAmount = Number(invoice.acompte_montant || 0);
  return {
    subtotal,
    taxAmount,
    total,
    acompteAmount,
    balance: Math.max(0, total - acompteAmount)
  };
}

function computeTotalsFromQuote(quote) {
  const subtotal = Number(quote.subtotal || 0);
  const subtotalAfterDiscount = Number(quote.subtotal_after_discount || subtotal);
  const total = Number(quote.total || 0);
  const taxAmount = Math.max(0, total - subtotalAfterDiscount);
  const discountAmount = Number(quote.discount_amount || 0);
  const acompteAmount = Number(quote.acompte_amount || 0);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    acompteAmount,
    balance: Math.max(0, total - acompteAmount)
  };
}

function drawInvoicePdfLayout(doc, invoice, items, client, settings, profitability = null) {
  const companyLines = formatCompanyBlock(settings);
  const clientLines = formatClientBlock(client);
  const metaLines = buildLines([
    `Date facture: ${clean(invoice.invoice_date, "-")}`,
    isFilled(invoice.due_date) ? `Echeance: ${clean(invoice.due_date)}` : null,
    isFilled(invoice.invoice_number) ? `Numero: ${clean(invoice.invoice_number)}` : null,
    isFilled(invoice.moyen_paiement) ? `Mode paiement: ${clean(invoice.moyen_paiement)}` : null
  ]);
  const paymentLines = Number(settings.show_bank_details ?? 1)
    ? buildLines([
        clean(settings.bank_name),
        isFilled(settings.bank_iban) ? `IBAN: ${clean(settings.bank_iban)}` : null,
        isFilled(settings.bank_bic) ? `BIC: ${clean(settings.bank_bic)}` : null
      ])
    : [];

  let y = drawHeader(doc, {
    typeLabel: "FACTURE",
    number: clean(invoice.invoice_number, "-"),
    logoDataUrl: settings.logo_data_url,
    companyLines,
    clientLines,
    metaLines,
    paymentLines
  });

  const showVat = Number(settings.show_vat ?? 1) === 1 && Number(invoice.tax_rate || 0) > 0;
  const table = drawItemsTable(doc, items, {
    startY: y,
    showVat,
    taxRate: invoice.tax_rate,
    currency: invoice.currency || "EUR"
  });
  y = table.y;

  y = drawTotals(doc, y, computeTotalsFromInvoice(invoice), {
    taxRate: invoice.tax_rate,
    showVat,
    currency: invoice.currency || "EUR"
  });

  if (profitability) {
    const lines = buildLines([
      `Rentabilite mission`,
      `Cout estime: ${moneyFr(profitability.cost_estimated, invoice.currency || "EUR")}`,
      `Marge brute: ${moneyFr(profitability.gross_margin, invoice.currency || "EUR")}`,
      `% marge: ${Number(profitability.margin_percent || 0).toFixed(2)}%`
    ]);
    y = drawFooterText(doc, y, lines);
  }

  const footerLines = buildLines([
    Number(settings.show_late_penalties ?? 1) === 1 && isFilled(settings.payment_terms)
      ? `Conditions de paiement: ${clean(settings.payment_terms)}`
      : null,
    Number(settings.show_late_penalties ?? 1) === 1 && isFilled(settings.late_penalty_rate)
      ? `Penalites de retard: ${clean(settings.late_penalty_rate)}`
      : null,
    Number(settings.show_fixed_indemnity ?? 1) === 1 && isFilled(settings.fixed_indemnity)
      ? `Indemnite forfaitaire de recouvrement (B2B): ${clean(settings.fixed_indemnity)}`
      : null,
    Number(settings.show_vat_exemption_mention ?? 1) === 1 &&
    Number(invoice.tax_rate || 0) === 0 &&
    isFilled(settings.vat_exemption_mention)
      ? clean(settings.vat_exemption_mention)
      : null
  ]);
  drawFooterText(doc, y, footerLines);
}

function drawQuotePdfLayout(doc, quote, items, client, settings) {
  const companyLines = formatCompanyBlock(settings);
  const clientLines = formatClientBlock(client);
  const metaLines = buildLines([
    `Date devis: ${clean(quote.quote_date, "-")}`,
    isFilled(quote.valid_until) ? `Valide jusqu'au: ${clean(quote.valid_until)}` : null,
    isFilled(quote.quote_number) ? `Numero: ${clean(quote.quote_number)}` : null,
    isFilled(quote.status) ? `Statut: ${clean(quote.status)}` : null
  ]);
  const paymentLines = Number(settings.show_bank_details ?? 1)
    ? buildLines([
        clean(settings.bank_name),
        isFilled(settings.bank_iban) ? `IBAN: ${clean(settings.bank_iban)}` : null,
        isFilled(settings.bank_bic) ? `BIC: ${clean(settings.bank_bic)}` : null
      ])
    : [];

  let y = drawHeader(doc, {
    typeLabel: "DEVIS",
    number: clean(quote.quote_number, "-"),
    logoDataUrl: settings.logo_data_url,
    companyLines,
    clientLines,
    metaLines,
    paymentLines
  });

  const showVat = Number(settings.show_vat ?? 1) === 1 && Number(quote.tax_rate || 0) > 0;
  const table = drawItemsTable(doc, items, {
    startY: y,
    showVat,
    taxRate: quote.tax_rate,
    currency: quote.currency || "EUR"
  });
  y = table.y;

  y = drawTotals(doc, y, computeTotalsFromQuote(quote), {
    taxRate: quote.tax_rate,
    showVat,
    currency: quote.currency || "EUR"
  });

  const quoteValidityDays = Number(settings.quote_validity_days || 0);
  const quoteFooter = buildLines([
    Number(settings.quote_show_validity_notice ?? 1) === 1 && quoteValidityDays > 0
      ? `Devis valable ${quoteValidityDays} jours`
      : null,
    Number(quote.acompte_percent || 0) > 0
      ? `Acompte de ${Number(quote.acompte_percent).toFixed(0)}% a la commande`
      : Number(quote.acompte_amount || 0) > 0
      ? `Acompte a la commande: ${moneyFr(quote.acompte_amount, quote.currency || "EUR")}`
      : null,
    isFilled(settings.payment_terms) ? `Conditions de paiement: ${clean(settings.payment_terms)}` : null,
    Number(settings.show_vat_exemption_mention ?? 1) === 1 &&
    Number(quote.tax_rate || 0) === 0 &&
    isFilled(settings.vat_exemption_mention)
      ? clean(settings.vat_exemption_mention)
      : null
  ]);
  y = drawFooterText(doc, y, quoteFooter);

  if (Number(settings.quote_show_signature_block ?? 1) === 1) {
    y = ensurePageSpace(doc, y, 58);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Bon pour accord", PAGE.marginX, y);
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Date, cachet et signature du client", PAGE.marginX, y + 14);
    doc.moveTo(PAGE.marginX, y + 45).lineTo(PAGE.marginX + 280, y + 45).strokeColor("#d8e0ef").stroke();
  }
}

async function buildInvoicePdf(invoice, items, client, companySettings = {}, profitability = null) {
  const doc = createDocument();
  drawInvoicePdfLayout(doc, invoice, items, client || {}, companySettings || {}, profitability);
  applyPageNumbers(doc);
  return finalize(doc);
}

async function buildQuotePdf(quote, items, client, companySettings = {}) {
  const doc = createDocument();
  drawQuotePdfLayout(doc, quote, items, client || {}, companySettings || {});
  applyPageNumbers(doc);
  return finalize(doc);
}

async function buildPaymentReceiptPdf(invoice, payment, client, companySettings = {}) {
  const doc = createDocument();
  const companyLines = formatCompanyBlock(companySettings);
  const clientLines = formatClientBlock(client);
  const metaLines = buildLines([
    `Recu: REC-${clean(payment.id, "-")}`,
    `Date: ${clean(payment.payment_date, "-")}`,
    `Facture: ${clean(invoice.invoice_number, "-")}`,
    `Montant: ${moneyFr(payment.amount, invoice.currency || "EUR")}`,
    isFilled(payment.method) ? `Mode: ${clean(payment.method)}` : null,
    isFilled(payment.reference) ? `Reference: ${clean(payment.reference)}` : null
  ]);

  let y = drawHeader(doc, {
    typeLabel: "RECU DE PAIEMENT",
    number: clean(invoice.invoice_number, "-"),
    logoDataUrl: companySettings.logo_data_url,
    companyLines,
    clientLines,
    metaLines,
    paymentLines: []
  });

  const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_received || 0));
  const lines = buildLines([
    "Ce recu atteste la bonne reception du paiement indique ci-dessus.",
    `Reste a payer sur facture: ${moneyFr(remaining, invoice.currency || "EUR")}`
  ]);
  y = drawFooterText(doc, y, lines);
  drawFooterText(doc, y, buildLines([clean(companySettings.payment_terms)]));

  applyPageNumbers(doc);
  return finalize(doc);
}

module.exports = { buildInvoicePdf, buildQuotePdf, buildPaymentReceiptPdf };
