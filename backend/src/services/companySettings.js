const db = require("../db");

function getPrimaryCompanyInsurance() {
  return (
    db
      .prepare(
        `SELECT provider, policy_number, coverage_details
         FROM insurances
         WHERE insured_entity_type = 'company'
         ORDER BY valid_until DESC, id DESC
         LIMIT 1`
      )
      .get() || null
  );
}

function getDocumentCompanySettings() {
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get() || {};
  const insurance = getPrimaryCompanyInsurance();

  return {
    ...settings,
    insurance_provider: settings.insurance_provider || insurance?.provider || "",
    insurance_contract_number:
      settings.insurance_contract_number || insurance?.policy_number || "",
    insurance_coverage_zone:
      settings.insurance_coverage_zone || insurance?.coverage_details || ""
  };
}

module.exports = {
  getDocumentCompanySettings
};
