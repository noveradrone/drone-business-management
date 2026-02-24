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

function generateInvoiceTable(doc, invoice, items, left, right, startY) {
  const tableX = left;
  const tableW = right - left;
  const c1 = tableX;
  const c2 = tableX + tableW * 0.36;
  const c3 = tableX + tableW * 0.49;
  const c4 = tableX + tableW * 0.63;
  const c5 = tableX + tableW * 0.79;
  const pageBottom = doc.page.height - 70;
  const vatRate = Number(invoice.tax_rate || 0);
  const dataRows = Array.isArray(items) && items.length ? items : [];
  let currentY = startY;

  function drawHeader() {
    const headerHeight = 26;
    doc
      .rect(tableX, currentY, tableW, headerHeight)
      .fillAndStroke("#fafcff", "#222222");
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10);
    doc.text("DESIGNATION", c1 + 8, currentY + 8, { width: c2 - c1 - 12, align: "center" });
    doc.text("QUANTITE", c2 + 4, currentY + 8, { width: c3 - c2 - 8, align: "center" });
    doc.text("PRIX", c3 + 4, currentY + 8, { width: c4 - c3 - 8, align: "center" });
    doc.text("TOTAL", c4 + 4, currentY + 8, { width: c5 - c4 - 8, align: "center" });
    doc.text("TVA", c5 + 4, currentY + 8, { width: tableX + tableW - c5 - 8, align: "center" });
    currentY += headerHeight + 6;
  }

  drawHeader();
  doc.font("Helvetica").fontSize(10.5).fillColor("#000000");

  dataRows.forEach((item) => {
    const description = safe(item.description, "-");
    const qtyText = `${Number(item.quantity || 0).toFixed(2)}`;
    const lineTotal = Number(item.total || 0);
    const vatText = `${moneyFr((lineTotal * vatRate) / 100, invoice.currency)} (${vatRate.toFixed(0)}%)`;

    const descHeight = doc.heightOfString(description, { width: c2 - c1 - 12 });
    const vatHeight = doc.heightOfString(vatText, { width: tableX + tableW - c5 - 12 });
    const rowHeight = Math.max(22, descHeight + 4, vatHeight + 4);

    if (currentY + rowHeight > pageBottom) {
      doc.addPage();
      currentY = 50;
      drawHeader();
      doc.font("Helvetica").fontSize(10.5).fillColor("#000000");
    }

    doc.text(description, c1 + 8, currentY + 2, { width: c2 - c1 - 12 });
    doc.text(qtyText, c2 + 6, currentY + 2, { width: c3 - c2 - 12 });
    doc.text(moneyFr(item.unit_price, invoice.currency), c3 + 6, currentY + 2, { width: c4 - c3 - 12 });
    doc.text(moneyFr(lineTotal, invoice.currency), c4 + 6, currentY + 2, { width: c5 - c4 - 12 });
    doc.text(vatText, c5 + 6, currentY + 2, { width: tableX + tableW - c5 - 12 });

    currentY += rowHeight;
    doc.moveTo(tableX, currentY).lineTo(tableX + tableW, currentY).stroke("#e5e7eb");
  });

  return { y: currentY + 14, vatRate };
}

function drawInvoiceLikeTemplate(doc, invoice, items, client, settings, profitability = null) {
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

  const tableResult = generateInvoiceTable(doc, invoice, items, left, right, 368);
  const taxValue = (Number(invoice.subtotal || 0) * tableResult.vatRate) / 100;
  let totalY = tableResult.y;
  const totalsBlockHeight = profitability ? 240 : 210;
  if (totalY + totalsBlockHeight > doc.page.height - 50) {
    doc.addPage();
    totalY = 60;
  }
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

  const acompteMontant = Number(invoice.acompte_montant || 0);
  const soldeRestant = Number(invoice.solde_restant || Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_received || 0)));
  doc.font("Helvetica").fontSize(11);
  doc.text("Acompte", labelX, totalY + 74, { width: 90, align: "right" });
  doc.text(moneyFr(acompteMontant, invoice.currency), valueX - 120, totalY + 74, { width: 120, align: "right" });
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Solde restant", labelX, totalY + 96, { width: 90, align: "right" });
  doc.text(moneyFr(soldeRestant, invoice.currency), valueX - 120, totalY + 96, { width: 120, align: "right" });

  if (profitability) {
    doc.font("Helvetica-Bold").fontSize(10).text("Rentabilite mission", left, totalY + 74);
    doc.font("Helvetica").fontSize(9.5);
    doc.text(`Cout estime mission: ${moneyFr(profitability.cost_estimated, invoice.currency)}`, left, totalY + 90);
    doc.text(`Marge brute: ${moneyFr(profitability.gross_margin, invoice.currency)}`, left, totalY + 104);
    doc.text(`% marge: ${Number(profitability.margin_percent || 0).toFixed(2)}%`, left, totalY + 118);
  }

  doc.font("Helvetica").fontSize(9);
  const legalY = totalY + 132;
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

  if (tableResult.vatRate === 0 && settings.vat_exemption_mention) {
    doc.text(`TVA non applicable: ${settings.vat_exemption_mention}`, left, legalY + 36, {
      width: right - left
    });
  }
}

function drawBasicQuote(doc, quote, items, client, settings) {
  const left = 42;
  const right = doc.page.width - 42;
  const width = right - left;
  const blue = "#0f3d91";
  const light = "#f4f7fc";
  const line = "#d8e0ef";
  const text = "#1f2937";
  const muted = "#6b7280";
  const logo = decodeDataUrl(settings.logo_data_url);

  doc.rect(left, 36, width, 88).fill(light);

  if (logo) {
    try {
      doc.image(logo, left + 12, 46, { fit: [92, 68] });
    } catch (error) {
      // Ignore invalid image payload.
    }
  } else {
    doc.rect(left + 12, 52, 92, 50).strokeColor(line).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(muted).text("LOGO", left + 45, 73);
  }

  doc.fillColor(blue).font("Helvetica-Bold").fontSize(34).text("DEVIS", right - 180, 50, {
    width: 170,
    align: "right"
  });
  doc.fillColor(text).font("Helvetica").fontSize(10);
  doc.text(`Numero: ${safe(quote.quote_number, "-")}`, right - 220, 92, { width: 210, align: "right" });
  doc.text(`Date: ${safe(quote.quote_date, "-")}`, right - 220, 108, { width: 210, align: "right" });
  doc.text(`Valide jusqu'au: ${safe(quote.valid_until, "-")}`, right - 220, 124, {
    width: 210,
    align: "right"
  });

  const infoY = 142;
  const colGap = 16;
  const colW = (width - colGap) / 2;

  doc.roundedRect(left, infoY, colW, 122, 8).strokeColor(line).stroke();
  doc.roundedRect(left + colW + colGap, infoY, colW, 122, 8).strokeColor(line).stroke();

  doc.fillColor(blue).font("Helvetica-Bold").fontSize(10).text("EMETTEUR", left + 12, infoY + 10);
  doc.fillColor(text).font("Helvetica").fontSize(10);
  doc.text(safe(settings.company_name, "Novera Drone"), left + 12, infoY + 28, { width: colW - 24 });
  doc.text(
    [safe(settings.address_line1), `${safe(settings.zip_code)} ${safe(settings.city)}`.trim()].filter(Boolean).join(" "),
    left + 12,
    infoY + 44,
    { width: colW - 24 }
  );
  doc.text(`SIRET: ${safe(settings.siret, "-")}`, left + 12, infoY + 60, { width: colW - 24 });
  doc.text(`TVA: ${safe(settings.vat_number, "-")}`, left + 12, infoY + 76, { width: colW - 24 });
  doc.text(`Tel: ${safe(settings.phone, "-")}`, left + 12, infoY + 92, { width: colW - 24 });
  doc.text(`Email: ${safe(settings.email, "-")}`, left + 12, infoY + 108, { width: colW - 24 });

  doc.fillColor(blue).font("Helvetica-Bold").fontSize(10).text("CLIENT", left + colW + colGap + 12, infoY + 10);
  doc.fillColor(text).font("Helvetica").fontSize(10);
  doc.text(safe(client.company_name, "-"), left + colW + colGap + 12, infoY + 28, { width: colW - 24 });
  doc.text(safe(client.contact_name, "-"), left + colW + colGap + 12, infoY + 44, { width: colW - 24 });
  doc.text(safe(client.billing_address, "-"), left + colW + colGap + 12, infoY + 60, { width: colW - 24 });
  doc.text(`SIRET: ${safe(client.siret, "-")}`, left + colW + colGap + 12, infoY + 76, { width: colW - 24 });
  doc.text(`TVA: ${safe(client.vat_number, "-")}`, left + colW + colGap + 12, infoY + 92, { width: colW - 24 });
  doc.text(`Tel: ${safe(client.phone, "-")}`, left + colW + colGap + 12, infoY + 108, { width: colW - 24 });

  const tableY = 286;
  const rowH = 24;
  const tableH = 240;
  const col = [
    left,
    left + width * 0.10,
    left + width * 0.54,
    left + width * 0.68,
    left + width * 0.84,
    right
  ];

  doc.rect(left, tableY, width, tableH).strokeColor(line).stroke();
  doc.rect(left, tableY, width, rowH).fillAndStroke(light, line);
  col.slice(1, -1).forEach((x) => doc.moveTo(x, tableY).lineTo(x, tableY + tableH).strokeColor(line).stroke());

  doc.fillColor(text).font("Helvetica-Bold").fontSize(9.5);
  doc.text("Qte", col[0] + 6, tableY + 7, { width: col[1] - col[0] - 10 });
  doc.text("Description", col[1] + 6, tableY + 7, { width: col[2] - col[1] - 10 });
  doc.text("PU HT", col[2] + 6, tableY + 7, { width: col[3] - col[2] - 10 });
  doc.text("TVA", col[3] + 6, tableY + 7, { width: col[4] - col[3] - 10 });
  doc.text("Total HT", col[4] + 6, tableY + 7, { width: col[5] - col[4] - 10 });

  const vatRate = Number(quote.tax_rate || 0);
  const maxRows = Math.max(1, Math.floor((tableH - rowH - 8) / 20));
  let y = tableY + rowH + 6;
  doc.font("Helvetica").fontSize(9.5).fillColor(text);
  (items || []).slice(0, maxRows).forEach((item) => {
    doc.text(Number(item.quantity || 0).toFixed(2), col[0] + 6, y, { width: col[1] - col[0] - 10 });
    doc.text(oneLine(item.description, 70), col[1] + 6, y, { width: col[2] - col[1] - 10 });
    doc.text(moneyFr(item.unit_price, "EUR"), col[2] + 6, y, { width: col[3] - col[2] - 10 });
    doc.text(`${vatRate.toFixed(0)}%`, col[3] + 6, y, { width: col[4] - col[3] - 10 });
    doc.text(moneyFr(item.total, "EUR"), col[4] + 6, y, { width: col[5] - col[4] - 10 });
    y += 20;
  });

  const taxValue = (Number(quote.subtotal || 0) * vatRate) / 100;
  const totalBoxY = 540;
  const totalBoxW = 220;
  const totalBoxX = right - totalBoxW;
  doc.roundedRect(totalBoxX, totalBoxY, totalBoxW, 92, 8).strokeColor(line).stroke();
  doc.font("Helvetica").fontSize(10).fillColor(muted);
  doc.text("Sous-total HT", totalBoxX + 10, totalBoxY + 12, { width: 110 });
  doc.text(moneyFr(quote.subtotal, "EUR"), totalBoxX + 120, totalBoxY + 12, { width: 90, align: "right" });
  doc.text(`TVA (${vatRate.toFixed(2)}%)`, totalBoxX + 10, totalBoxY + 34, { width: 110 });
  doc.text(moneyFr(taxValue, "EUR"), totalBoxX + 120, totalBoxY + 34, { width: 90, align: "right" });
  doc.font("Helvetica-Bold").fillColor(blue);
  doc.text("Total TTC", totalBoxX + 10, totalBoxY + 60, { width: 110 });
  doc.text(moneyFr(quote.total, "EUR"), totalBoxX + 120, totalBoxY + 60, { width: 90, align: "right" });

  doc.font("Helvetica").fontSize(9).fillColor(muted);
  doc.text(`Conditions de paiement: ${oneLine(settings.payment_terms, 70) || "-"}`, left, 546, { width: 300 });
  doc.text(`Validite: ${safe(quote.valid_until, "-")}`, left, 562, { width: 300 });
  doc.text(
    `TVA non applicable: ${safe(settings.vat_exemption_mention, "N/A")}`,
    left,
    578,
    { width: 300 }
  );

  doc.font("Helvetica-Bold").fontSize(10).fillColor(text).text("Bon pour accord", left, 652);
  doc.font("Helvetica").fontSize(9).fillColor(muted).text("Date, cachet et signature du client", left, 668);
  doc.moveTo(left, 712).lineTo(left + 290, 712).strokeColor(line).stroke();
}

function finalize(doc) {
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildInvoicePdf(invoice, items, client, companySettings = {}, profitability = null) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  drawInvoiceLikeTemplate(doc, invoice, items, client || {}, companySettings || {}, profitability);
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
