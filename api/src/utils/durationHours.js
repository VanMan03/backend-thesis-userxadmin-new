const MIN_DURATION_HOURS = 0.5;
const MAX_DURATION_HOURS = 12;

function toNumericDuration(rawValue) {
  if (rawValue === undefined || rawValue === null) return null;

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;

    const matched = trimmed.match(/-?\d+(\.\d+)?/);
    if (!matched) return null;
    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isValidDurationHours(value) {
  return (
    Number.isFinite(value) &&
    value >= MIN_DURATION_HOURS &&
    value <= MAX_DURATION_HOURS
  );
}

function resolveDurationHours(source) {
  if (!source || typeof source !== "object") return null;

  const candidates = [
    source.durationHours,
    source.estimatedDuration,
    source.duration
  ];

  for (const candidate of candidates) {
    const normalized = toNumericDuration(candidate);
    if (normalized !== null && isValidDurationHours(normalized)) {
      return normalized;
    }
  }

  return null;
}

function parseDurationHoursFromPayload(payload = {}) {
  const hasDurationHours = Object.prototype.hasOwnProperty.call(payload, "durationHours");
  const hasEstimatedDuration = Object.prototype.hasOwnProperty.call(payload, "estimatedDuration");
  const hasDuration = Object.prototype.hasOwnProperty.call(payload, "duration");
  const hasAnyDurationInput = hasDurationHours || hasEstimatedDuration || hasDuration;

  if (!hasAnyDurationInput) {
    return { hasAnyDurationInput: false, value: undefined };
  }

  const rawValue = hasDurationHours
    ? payload.durationHours
    : hasEstimatedDuration
      ? payload.estimatedDuration
      : payload.duration;
  const value = toNumericDuration(rawValue);

  if (!isValidDurationHours(value)) {
    const err = new Error(
      `durationHours must be a number between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS}`
    );
    err.status = 400;
    throw err;
  }

  return { hasAnyDurationInput: true, value };
}

function applyDurationHoursCompatibility(destination) {
  if (!destination || typeof destination !== "object") return destination;

  return {
    ...destination,
    durationHours: resolveDurationHours(destination)
  };
}

module.exports = {
  MIN_DURATION_HOURS,
  MAX_DURATION_HOURS,
  isValidDurationHours,
  resolveDurationHours,
  parseDurationHoursFromPayload,
  applyDurationHoursCompatibility
};
