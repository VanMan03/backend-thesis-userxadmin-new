function normalizeSelectedDates(selectedDatesInput) {
  if (selectedDatesInput === undefined) {
    return { provided: false, value: undefined, invalidCount: 0 };
  }

  if (selectedDatesInput === null) {
    return { provided: true, value: [], invalidCount: 0 };
  }

  if (!Array.isArray(selectedDatesInput)) {
    return {
      provided: true,
      error: "selectedDates must be an array of date strings"
    };
  }

  const parsedIsoDates = [];
  let invalidCount = 0;

  selectedDatesInput.forEach((value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      invalidCount += 1;
      return;
    }
    parsedIsoDates.push(parsed.toISOString());
  });

  const uniqueSorted = Array.from(new Set(parsedIsoDates)).sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime()
  );

  return {
    provided: true,
    value: uniqueSorted,
    invalidCount
  };
}

function applySelectedDatesToItinerary({
  selectedDatesInput,
  currentDays,
  daysInputProvided,
  normalizedDays
}) {
  const normalizedSelectedDates = normalizeSelectedDates(selectedDatesInput);
  if (normalizedSelectedDates.error) {
    return { error: normalizedSelectedDates.error };
  }

  let resolvedDays = normalizedDays;

  if (normalizedSelectedDates.provided) {
    if (daysInputProvided && resolvedDays !== normalizedSelectedDates.value.length) {
      return {
        error: "selectedDates length must match trip days"
      };
    }

    if (!daysInputProvided) {
      resolvedDays = normalizedSelectedDates.value.length || null;
    }
  }

  return {
    selectedDates: normalizedSelectedDates.value,
    selectedDatesProvided: normalizedSelectedDates.provided,
    invalidSelectedDatesCount: normalizedSelectedDates.invalidCount,
    days: resolvedDays === undefined ? currentDays : resolvedDays
  };
}

module.exports = {
  normalizeSelectedDates,
  applySelectedDatesToItinerary
};
