const OPENROUTE_BASE_URL = "https://api.openrouteservice.org";

function getApiKey() {
  const apiKey = process.env.OPENROUTES_API_KEY || process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTES_API_KEY (or OPENROUTESERVICE_API_KEY) is missing");
  }
  return apiKey;
}

async function reverseGeocode(longitude, latitude) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    "point.lon": String(longitude),
    "point.lat": String(latitude),
    size: "1"
  });

  const response = await fetch(
    `${OPENROUTE_BASE_URL}/geocode/reverse?${params.toString()}`,
    {
      headers: {
        Authorization: apiKey
      }
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ORS reverse geocode failed: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const firstFeature = payload?.features?.[0];
  return firstFeature?.properties?.label || null;
}

async function getRouteSummary({
  startLongitude,
  startLatitude,
  endLongitude,
  endLatitude,
  profile = "driving-car"
}) {
  const apiKey = getApiKey();
  const response = await fetch(
    `${OPENROUTE_BASE_URL}/v2/directions/${profile}/geojson`,
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [startLongitude, startLatitude],
          [endLongitude, endLatitude]
        ]
      })
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ORS directions failed: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const summary = payload?.features?.[0]?.properties?.summary || {};

  return {
    distanceMeters: summary.distance ?? null,
    durationSeconds: summary.duration ?? null
  };
}

module.exports = {
  getRouteSummary,
  reverseGeocode
};
