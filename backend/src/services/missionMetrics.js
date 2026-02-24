function parseNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeMissionFinancials(mission, revenue = 0) {
  const preparationHours = parseNumber(mission.preparation_hours);
  const flightHours = parseNumber(mission.flight_time_hours || mission.flight_hours_logged);
  const montageHours = parseNumber(mission.montage_hours);
  const variableCosts = parseNumber(mission.variable_costs);
  const totalHours = preparationHours + flightHours + montageHours;
  const totalRevenue = parseNumber(revenue);
  const totalCost = variableCosts;
  const grossMargin = totalRevenue - totalCost;
  const effectiveHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

  return {
    total_hours: totalHours,
    total_cost: totalCost,
    gross_margin: grossMargin,
    effective_hourly_rate: effectiveHourlyRate
  };
}

module.exports = {
  computeMissionFinancials
};
