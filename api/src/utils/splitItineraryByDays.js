function normalizeDays(daysInput) {
  if (daysInput === undefined || daysInput === null || daysInput === "") {
    return null;
  }

  const parsed = Number(daysInput);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function splitDestinationsByDays(destinations = [], daysInput) {
  const normalizedDays = normalizeDays(daysInput);
  if (!normalizedDays) {
    return { days: null, dayPlans: [] };
  }

  const total = destinations.length;
  const baseSize = Math.floor(total / normalizedDays);
  const remainder = total % normalizedDays;
  const dayPlans = [];
  let cursor = 0;

  for (let index = 0; index < normalizedDays; index += 1) {
    const take = baseSize + (index < remainder ? 1 : 0);
    const dayDestinations = destinations.slice(cursor, cursor + take);
    cursor += take;

    const dayCost = dayDestinations.reduce(
      (sum, item) => sum + (Number(item.cost) || 0),
      0
    );

    dayPlans.push({
      dayNumber: index + 1,
      destinations: dayDestinations,
      dayCost
    });
  }

  return { days: normalizedDays, dayPlans };
}

module.exports = {
  normalizeDays,
  splitDestinationsByDays
};
