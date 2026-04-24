const mongoose = require("mongoose");

function extractDestinationId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  return (
    value.destinationId?.toString?.()
    || value.destination?._id?.toString?.()
    || value.destination?.toString?.()
    || value._id?.toString?.()
    || null
  );
}

function toMinutes(timeValue) {
  if (typeof timeValue !== "string") return null;
  const trimmed = timeValue.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  return (hours * 60) + minutes + (seconds / 60);
}

function normalizeInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function validateAndNormalizeStops({
  stopsInput,
  allowedDestinationIds = [],
  tripDays = null
}) {
  if (stopsInput === undefined) {
    return { ok: true, provided: false, stops: [] };
  }

  if (!Array.isArray(stopsInput)) {
    return { ok: false, message: "stops must be an array" };
  }

  const allowedSet = new Set(
    allowedDestinationIds
      .map((id) => id?.toString())
      .filter(Boolean)
  );
  const normalizedStops = [];

  for (let index = 0; index < stopsInput.length; index += 1) {
    const item = stopsInput[index];
    const destinationId = extractDestinationId(item);
    if (!destinationId || !mongoose.Types.ObjectId.isValid(destinationId)) {
      return { ok: false, message: `stops[${index}].destinationId is invalid` };
    }

    if (allowedSet.size && !allowedSet.has(destinationId.toString())) {
      return { ok: false, message: `stops[${index}].destinationId must belong to itinerary` };
    }

    const day = normalizeInteger(item?.day);
    if (!day) {
      return { ok: false, message: `stops[${index}].day must be a positive integer` };
    }

    if (tripDays && day > tripDays) {
      return { ok: false, message: `stops[${index}].day must be within tripDays` };
    }

    const sequence = normalizeInteger(item?.sequence);
    if (!sequence) {
      return { ok: false, message: `stops[${index}].sequence must be a positive integer` };
    }

    const startTime = item?.startTime;
    const endTime = item?.endTime;
    const startMins = toMinutes(startTime);
    const endMins = toMinutes(endTime);

    if (startMins === null) {
      return { ok: false, message: `stops[${index}].startTime must be HH:mm or HH:mm:ss` };
    }
    if (endMins === null) {
      return { ok: false, message: `stops[${index}].endTime must be HH:mm or HH:mm:ss` };
    }
    if (startMins >= endMins) {
      return { ok: false, message: `stops[${index}] startTime must be earlier than endTime` };
    }

    normalizedStops.push({
      destinationId,
      day,
      sequence,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      timezone: typeof item?.timezone === "string" && item.timezone.trim()
        ? item.timezone.trim()
        : null
    });
  }

  const byDay = new Map();
  normalizedStops.forEach((stop) => {
    if (!byDay.has(stop.day)) byDay.set(stop.day, []);
    byDay.get(stop.day).push(stop);
  });

  for (const [day, dayStops] of byDay.entries()) {
    dayStops.sort((a, b) => {
      const startDiff = toMinutes(a.startTime) - toMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return a.sequence - b.sequence;
    });
    for (let i = 1; i < dayStops.length; i += 1) {
      const prev = dayStops[i - 1];
      const current = dayStops[i];
      if (toMinutes(current.startTime) < toMinutes(prev.endTime)) {
        return { ok: false, message: `stops overlap on day ${day}` };
      }
    }
  }

  return {
    ok: true,
    provided: true,
    stops: normalizedStops.sort((a, b) => a.day - b.day || a.sequence - b.sequence)
  };
}

function buildFallbackStops({ stops, destinations = [], dayPlans = [], days = null }) {
  if (Array.isArray(stops) && stops.length) {
    return stops.map((item) => ({
      destinationId: extractDestinationId(item.destinationId || item.destination) || null,
      day: item.day ?? null,
      sequence: item.sequence ?? null,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      timezone: item.timezone ?? null
    }));
  }

  const generated = [];
  if (Array.isArray(dayPlans) && dayPlans.length) {
    dayPlans.forEach((plan) => {
      const dayNumber = normalizeInteger(plan?.dayNumber) || 1;
      const items = Array.isArray(plan?.destinations) ? plan.destinations : [];
      items.forEach((item, index) => {
        const destinationId = extractDestinationId(item?.destination);
        if (!destinationId) return;
        generated.push({
          destinationId,
          day: dayNumber,
          sequence: index + 1,
          startTime: null,
          endTime: null,
          timezone: null
        });
      });
    });
  }

  if (generated.length) {
    return generated;
  }

  const totalDays = normalizeInteger(days) || 1;
  return (Array.isArray(destinations) ? destinations : [])
    .map((item, index) => {
      const destinationId = extractDestinationId(item?.destination);
      if (!destinationId) return null;
      return {
        destinationId,
        day: Math.min(totalDays, (index % totalDays) + 1),
        sequence: index + 1,
        startTime: null,
        endTime: null,
        timezone: null
      };
    })
    .filter(Boolean);
}

module.exports = {
  extractDestinationId,
  validateAndNormalizeStops,
  buildFallbackStops
};
