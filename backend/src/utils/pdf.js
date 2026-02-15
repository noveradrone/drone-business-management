const PDFDocument = require("pdfkit");

function safe(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function oneLine(value, max = 95) {
  const text = safe(value, "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function moneyFr(value, currency = "EUR") {
  const n = Number(value || 0);
  const amount = n.toFixed(2).replace(".", ",");
  return currency === "EUR" ? `${amount} EUR` : `${amount} ${currency}`;
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

function drawBox(doc, x, y, w, h) {
  doc.rect(x, y, w, h).lineWidth(1).stroke("#222222");
}

function drawInvoiceLikeTemplate(doc, invoice, items, client, settings) {
  const pageW = doc.page.width;
  const left = 50;
  const right = pageW - 50;

  const logo = decodeDataUrl(settings.logo_data_url);
  if (logo) {
    try {
      doc.image(logo, left, 40, { fit: [120, 60] });
    } catch (error) {
      // Ignore invalid image payload.
    }
  }

  const topY = 130;
  const colGap = 30;
  const colW = (right - left - colGap) / 2;

  doc.font("Helvetica-Bold").fontSize(12).text("DESTINATAIRE", left, topY);
  doc.font("Helvetica").fontSize(11);
  doc.text(safe(client.company_name, "[Nom de l'entreprise du client]"), left, topY + 22, { width: colW });
  doc.text(safe(client.billing_address, "[Adresse de l'entreprise du client]"), left, topY + 42, { width: colW });
  doc.text(`SIRET: ${safe(client.siret, "[SIRET du client]")}`, left, topY + 62, { width: colW });
  doc.text(`No de TVA: ${safe(client.vat_number, "[Numero de TVA du client]")}`, left, topY + 82, { width: colW });

  const rightX = left + colW + colGap;
  doc.font("Helvetica-Bold").fontSize(12).text(safe(settings.company_name, "Novera Drone"), rightX, topY, {
    width: colW
  });
  doc.font("Helvetica").fontSize(11);
  const sellerAddress = [safe(settings.address_line1), `${safe(settings.zip_code)} ${safe(settings.city)}`.trim()]
    .filter(Boolean)
    .join(" ");
  doc.text(safe(sellerAddress, "[Adresse]"), rightX, topY + 22, { width: colW });
  doc.text(`SIRET: ${safe(settings.siret, "[SIRET]")}`, rightX, topY + 42, { width: colW });
  doc.text(`No de TVA: ${safe(settings.vat_number, "[Numero de TVA]")}`, rightX, topY + 62, { width: colW });
  doc.text(`Tel: ${safe(settings.phone, "[Telephone]")}`, rightX, topY + 82, { width: colW });

  const infoY = 250;
  doc.font("Helvetica").fontSize(11);
  doc.text(`Date de facture: ${safe(invoice.invoice_date, "-")}`, left, infoY);
  doc.font("Helvetica-Bold").text(`Echeance: ${safe(invoice.due_date, "-")}`, left, infoY + 22);

  doc.font("Helvetica").fontSize(11);
  doc.text(safe(settings.bank_name, "[Nom de la banque]"), rightX, infoY, { width: colW });
  doc.text(`SWIFT/BIC: ${safe(settings.bank_bic, "[SWIFT/BIC]")}`, rightX, infoY + 20, { width: colW });
  doc.text(`IBAN: ${safe(settings.bank_iban, "[Compte bancaire (IBAN)]")}`, rightX, infoY + 40, {
    width: colW
  });

  doc.font("Helvetica-Bold").fontSize(40).fillColor("#f1f1f1").text("FACTURE", left, 320, {
    width: right - left,
    align: "center"
  });
  doc.fillColor("#000000");
  doc.font("Helvetica-Bold").fontSize(16).text(`Facture No ${safe(invoice.invoice_number, "-")}`, left, 334, {
    width: right - left,
    align: "center"
  });

  const tableX = left;
  const tableY = 360;
  const tableW = right - left;
  const tableH = 280;

  const c1 = tableX;
  const c2 = tableX + tableW * 0.36;
  const c3 = tableX + tableW * 0.49;
  const c4 = tableX + tableW * 0.63;
  const c5 = tableX + tableW * 0.79;

  drawBox(doc, tableX, tableY, tableW, tableH);
  doc.moveTo(tableX, tableY + 30).lineTo(tableX + tableW, tableY + 30).stroke("#222222");
  [c2, c3, c4, c5].forEach((x) => doc.moveTo(x, tableY).lineTo(x, tableY + tableH).stroke("#222222"));

  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("DESIGNATION", c1 + 8, tableY + 9, { width: c2 - c1 - 12, align: "center" });
  doc.text("QUANTITE", c2 + 4, tableY + 9, { width: c3 - c2 - 8, align: "center" });
  doc.text("PRIX", c3 + 4, tableY + 9, { width: c4 - c3 - 8, align: "center" });
  doc.text("TOTAL", c4 + 4, tableY + 9, { width: c5 - c4 - 8, align: "center" });
  doc.text("TVA", c5 + 4, tableY + 9, { width: tableX + tableW - c5 - 8, align: "center" });

  const vatRate = Number(invoice.tax_rate || 0);
  const maxRows = Math.max(1, Math.floor((tableH - 46) / 22));
  let rowY = tableY + 38;
  doc.font("Helvetica").fontSize(11);

  (items || []).slice(0, maxRows).forEach((item) => {
    const lineTotal = Number(item.total || 0);
    const vatValue = (lineTotal * vatRate) / 100;

    doc.text(safe(item.description, "-"), c1 + 8, rowY, { width: c2 - c1 - 12 });
    doc.text(`${Number(item.quantity || 0).toFixed(2)}`, c2 + 6, rowY, { width: c3 - c2 - 12 });
    doc.text(moneyFr(item.unit_price, invoice.currency), c3 + 6, rowY, { width: c4 - c3 - 12 });
    doc.text(moneyFr(lineTotal, invoice.currency), c4 + 6, rowY, { width: c5 - c4 - 12 });
    doc.text(`${moneyFr(vatValue, invoice.currency)} (${vatRate.toFixed(0)}%)`, c5 + 6, rowY, {
      width: tableX + tableW - c5 - 12
    });

    rowY += 22;
  });

  const taxValue = (Number(invoice.subtotal || 0) * vatRate) / 100;
  const totalY = tableY + tableH + 22;
  const labelX = right - 190;
  const valueX = right - 10;

  doc.font("Helvetica").fontSize(12);
  doc.text("TOTAL", labelX, totalY, { width: 90, align: "right" });
  doc.text(moneyFr(invoice.subtotal, invoice.currency), valueX - 120, totalY, { width: 120, align: "right" });

  doc.text("TVA", labelX, totalY + 24, { width: 90, align: "right" });
  doc.text(moneyFr(taxValue, invoice.currency), valueX - 120, totalY + 24, { width: 120, align: "right" });

  doc.font("Helvetica-Bold").fontSize(13);
  doc.text("Total TTC", labelX, totalY + 50, { width: 90, align: "right" });
  doc.text(moneyFr(invoice.total, invoice.currency), valueX - 120, totalY + 50, { width: 120, align: "right" });

  doc.font("Helvetica").fontSize(9);
  const legalY = totalY + 72;
  doc.text(`Conditions de reglement: ${oneLine(settings.payment_terms, 85) || "Paiement a 30 jours"}`, left, legalY, {
    width: right - left
  });
  doc.text(`Penalites de retard: ${oneLine(settings.late_penalty_rate, 85) || "Taux BCE + 10 points"}`, left, legalY + 12, {
    width: right - left
  });
  doc.text(
    `Indemnite forfaitaire de recouvrement (B2B): ${oneLine(settings.fixed_indemnity, 65) || "40 EUR"}`,
    left,
    legalY + 24,
    { width: right - left }
  );

  if (vatRate === 0 && settings.vat_exemption_mention) {
    doc.text(`TVA non applicable: ${settings.vat_exemption_mention}`, left, legalY + 36, {
      width: right - left
    });
  }
}

function drawBasicQuote(doc, quote, items, client, settings) {
  const left = 45;
  const right = doc.page.width - 45;
  const logo = decodeDataUrl(settings.logo_data_url);
  if (logo) {
    try {
      doc.image(logo, left, 40, { fit: [90, 60] });
    } catch (error) {
      // Ignore invalid image payload.
    }
  }

  doc.font("Helvetica-Bold").fontSize(20).text("DEVIS", 0, 50, { align: "right" });
  doc.font("Helvetica").fontSize(11).text(`No ${safe(quote.quote_number)}`, { align: "right" });

  doc.moveDown(2);
  doc.font("Helvetica-Bold").fontSize(11).text(safe(settings.company_name, "Novera Drone"), left);
  doc.font("Helvetica").fontSize(10);
  doc.text([safe(settings.address_line1), `${safe(settings.zip_code)} ${safe(settings.city)}`.trim()].filter(Boolean).join(" "));
  doc.text(`SIRET: ${safe(settings.siret, "-")} - TVA: ${safe(settings.vat_number, "-")}`);

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").text("Client");
  doc.font("Helvetica");
  doc.text(safe(client.company_name, "-"));
  doc.text(safe(client.billing_address, "-"));

  doc.moveDown(1);
  doc.text(`Date devis: ${safe(quote.quote_date)}`);
  doc.text(`Validite: ${safe(quote.valid_until, "-")}`);

  const tableX = left;
  const tableY = doc.y + 16;
  const tableW = right - left;
  const rowH = 24;

  drawBox(doc, tableX, tableY, tableW, rowH);
  doc.font("Helvetica-Bold").text("Designation", tableX + 8, tableY + 7, { width: tableW * 0.5 });
  doc.text("Qte", tableX + tableW * 0.52, tableY + 7, { width: tableW * 0.12 });
  doc.text("PU", tableX + tableW * 0.66, tableY + 7, { width: tableW * 0.14 });
  doc.text("Total", tableX + tableW * 0.82, tableY + 7, { width: tableW * 0.16 });

  let y = tableY + rowH;
  doc.font("Helvetica").fontSize(10);
  (items || []).forEach((item) => {
    drawBox(doc, tableX, y, tableW, rowH);
    doc.text(safe(item.description, "-"), tableX + 8, y + 7, { width: tableW * 0.5 });
    doc.text(`${Number(item.quantity || 0).toFixed(2)}`, tableX + tableW * 0.52, y + 7, { width: tableW * 0.12 });
    doc.text(moneyFr(item.unit_price, "EUR"), tableX + tableW * 0.66, y + 7, { width: tableW * 0.14 });
    doc.text(moneyFr(item.total, "EUR"), tableX + tableW * 0.82, y + 7, { width: tableW * 0.16 });
    y += rowH;
  });

  const taxValue = (Number(quote.subtotal || 0) * Number(quote.tax_rate || 0)) / 100;
  doc.moveDown(2.4);
  doc.font("Helvetica-Bold").text(`Total HT: ${moneyFr(quote.subtotal)}`, { align: "right" });
  doc.text(`TVA (${Number(quote.tax_rate || 0).toFixed(2)}%): ${moneyFr(taxValue)}`, { align: "right" });
  doc.text(`Total TTC: ${moneyFr(quote.total)}`, { align: "right" });
}

function finalize(doc) {
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildInvoicePdf(invoice, items, client, companySettings = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  drawInvoiceLikeTemplate(doc, invoice, items, client || {}, companySettings || {});
  return finalize(doc);
}

function buildQuotePdf(quote, items, client, companySettings = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  drawBasicQuote(doc, quote, items, client || {}, companySettings || {});
  return finalize(doc);
}

function buildPaymentReceiptPdf(invoice, payment, client, companySettings = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 46 });
  const left = 46;
  const right = doc.page.width - 46;
  const logo = decodeDataUrl(companySettings.logo_data_url);

  if (logo) {
    try {
      doc.image(logo, left, 36, { fit: [110, 60] });
    } catch (error) {
      // Ignore invalid image payload.
    }
  }

  doc.font("Helvetica-Bold").fontSize(20).text("RECU DE PAIEMENT", 0, 44, { align: "right" });
  doc.font("Helvetica").fontSize(11).text(`No recu: REC-${safe(payment.id)}`, { align: "right" });
  doc.text(`Date: ${safe(payment.payment_date)}`, { align: "right" });

  doc.moveDown(2.4);
  doc.font("Helvetica-Bold").fontSize(12).text(safe(companySettings.company_name, "Novera Drone"), left);
  doc.font("Helvetica").fontSize(10);
  const sellerAddress = [safe(companySettings.address_line1), `${safe(companySettings.zip_code)} ${safe(companySettings.city)}`.trim()]
    .filter(Boolean)
    .join(" ");
  doc.text(sellerAddress || "-");
  doc.text(`SIRET: ${safe(companySettings.siret, "-")} | TVA: ${safe(companySettings.vat_number, "-")}`);

  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(11).text("Client");
  doc.font("Helvetica").fontSize(10);
  doc.text(safe(client.company_name, "-"));
  doc.text(safe(client.billing_address, "-"));

  doc.moveDown(1.4);
  drawBox(doc, left, doc.y, right - left, 145);
  let y = doc.y + 14;
  doc.font("Helvetica").fontSize(11);
  doc.text(`Facture concernee: ${safe(invoice.invoice_number, "-")}`, left + 14, y);
  y += 24;
  doc.text(`Montant encaisse: ${moneyFr(payment.amount, safe(invoice.currency, "EUR"))}`, left + 14, y);
  y += 24;
  doc.text(`Mode de paiement: ${safe(payment.method, "-")}`, left + 14, y);
  y += 24;
  doc.text(`Reference: ${safe(payment.reference, "-")}`, left + 14, y);
  y += 24;
  doc.text(`Reste a payer sur facture: ${moneyFr(Number(invoice.total || 0) - Number(invoice.amount_received || 0), safe(invoice.currency, "EUR"))}`, left + 14, y);

  doc.moveDown(7.4);
  doc.font("Helvetica").fontSize(10);
  doc.text("Ce recu atteste la bonne reception du paiement indique ci-dessus.");
  doc.text(`Entreprise: ${safe(companySettings.company_name, "Novera Drone")}`);

  return finalize(doc);
}

module.exports = { buildInvoicePdf, buildQuotePdf, buildPaymentReceiptPdf };
