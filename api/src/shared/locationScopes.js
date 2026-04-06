const LOCATION_SCOPES = [
  "IN_BULUSAN",
  "NEAR_BULUSAN",
  "SORSOGON",
  "BICOL_REGION",
  "OUTSIDE_BICOL"
];

const DEFAULT_LOCATION_SCOPE = "IN_BULUSAN";

function normalizeLocationScope(value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      const err = new Error("locationScope is required");
      err.status = 400;
      throw err;
    }
    return undefined;
  }

  if (typeof value !== "string") {
    const err = new Error("locationScope must be a string");
    err.status = 400;
    throw err;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      const err = new Error("locationScope is required");
      err.status = 400;
      throw err;
    }
    return undefined;
  }

  if (!LOCATION_SCOPES.includes(trimmed)) {
    const err = new Error(
      `locationScope must be one of: ${LOCATION_SCOPES.join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  return trimmed;
}

module.exports = {
  LOCATION_SCOPES,
  DEFAULT_LOCATION_SCOPE,
  normalizeLocationScope
};
