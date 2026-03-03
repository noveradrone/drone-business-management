function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return !Number.isNaN(value);
  return String(value).trim() !== "";
}

function clean(value, fallback = "") {
  return isFilled(value) ? String(value).trim() : fallback;
}

function joinFilled(parts, separator = " ") {
  return (parts || [])
    .map((p) => clean(p))
    .filter((p) => isFilled(p))
    .join(separator);
}

function formatCompanyBlock(company = {}) {
  const lines = [];
  const nameLine = joinFilled([company.company_name, company.legal_form], " - ");
  if (isFilled(nameLine)) lines.push(nameLine);

  const addressLine = joinFilled(
    [company.address_line1, joinFilled([company.zip_code, company.city], " "), company.country],
    ", "
  );
  if (isFilled(addressLine)) lines.push(addressLine);

  if (isFilled(company.siret)) lines.push(`SIRET: ${clean(company.siret)}`);
  if (isFilled(company.vat_number)) lines.push(`TVA: ${clean(company.vat_number)}`);
  if (isFilled(company.rcs_info)) lines.push(`RCS: ${clean(company.rcs_info)}`);

  const contactLine = joinFilled([company.phone, company.email], " | ");
  if (isFilled(contactLine)) lines.push(contactLine);
  if (isFilled(company.website)) lines.push(clean(company.website));
  return lines;
}

function formatClientBlock(client = {}) {
  const lines = [];
  if (isFilled(client.company_name)) lines.push(clean(client.company_name));
  if (isFilled(client.contact_name)) lines.push(clean(client.contact_name));
  if (isFilled(client.billing_address)) lines.push(clean(client.billing_address));
  if (isFilled(client.siret)) lines.push(`SIRET: ${clean(client.siret)}`);
  if (isFilled(client.vat_number)) lines.push(`TVA: ${clean(client.vat_number)}`);
  if (isFilled(client.phone)) lines.push(`Tel: ${clean(client.phone)}`);
  if (isFilled(client.email)) lines.push(clean(client.email));
  return lines;
}

module.exports = {
  isFilled,
  clean,
  joinFilled,
  formatCompanyBlock,
  formatClientBlock
};
