const {
  getRouteSummary,
  optimizeRoute,
  sortDestinationsByDistance,
  normalizeMapboxProfile
} = require("../services/mapboxService");
const Destination = require("../models/Destination");

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCoordinate(body, query, primaryKey, aliases = []) {
  const sources = [body || {}, query || {}];
  for (const source of sources) {
    if (Object.prototype.hasOwnProperty.call(source, primaryKey)) {
      return source[primaryKey];
    }

    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(source, alias)) {
        return source[alias];
      }
    }
  }

  return undefined;
}

function resolveDestinationId(body) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  if (body.destinationId) return body.destinationId;
  if (body.destinationID) return body.destinationID;
  if (body.destination) {
    if (typeof body.destination === "string") return body.destination;
    if (body.destination._id) return body.destination._id;
    if (body.destination.id) return body.destination.id;
  }
  return undefined;
}

function resolveSingleRouteCoordinates(body, query) {
  let startLongitude = toNumber(resolveCoordinate(body, query, "userLongitude", [
    "longitude",
    "lng",
    "startLongitude",
    "startLng",
    "originLongitude"
  ]));
  let startLatitude = toNumber(resolveCoordinate(body, query, "userLatitude", [
    "latitude",
    "lat",
    "startLatitude",
    "startLat",
    "originLatitude"
  ]));
  let endLongitude = toNumber(resolveCoordinate(body, query, "destinationLongitude", [
    "endLongitude",
    "endLng"
  ]));
  let endLatitude = toNumber(resolveCoordinate(body, query, "destinationLatitude", [
    "endLatitude",
    "endLat"
  ]));

  if (startLongitude === null || startLatitude === null) {
    if (body?.origin && typeof body.origin === "object") {
      startLongitude = toNumber(body.origin.longitude);
      startLatitude = toNumber(body.origin.latitude);
    }
  }

  if (endLongitude === null || endLatitude === null) {
    if (body?.destination && typeof body.destination === "object") {
      endLongitude = toNumber(body.destination.longitude);
      endLatitude = toNumber(body.destination.latitude);
    }
  }

  if ((startLongitude === null || startLatitude === null || endLongitude === null || endLatitude === null)
    && Array.isArray(body?.coordinates)
    && body.coordinates.length >= 2
    && Array.isArray(body.coordinates[0])
    && Array.isArray(body.coordinates[1])) {
    startLongitude = toNumber(body.coordinates[0][0]);
    startLatitude = toNumber(body.coordinates[0][1]);
    endLongitude = toNumber(body.coordinates[1][0]);
    endLatitude = toNumber(body.coordinates[1][1]);
  }

  return {
    startLongitude,
    startLatitude,
    endLongitude,
    endLatitude
  };
}

/**
 * Get route between user location and a single destination
 */
exports.getSingleRoute = async (req, res) => {
  try {
    const {
      startLongitude,
      startLatitude,
      endLongitude,
      endLatitude
    } = resolveSingleRouteCoordinates(req.body, req.query);
    const destinationId = resolveDestinationId(req.body);
    const profile = normalizeMapboxProfile(req.body?.profile || req.query?.profile);

    if (startLongitude === null || startLatitude === null) {
      return res.status(400).json({
        message: "Invalid payload. Origin coordinates are required",
        expected: {
          origin: [
            { userLongitude: "number", userLatitude: "number" },
            { originLongitude: "number", originLatitude: "number" },
            { origin: { longitude: "number", latitude: "number" } },
            { coordinates: "[[originLng, originLat], [destinationLng, destinationLat]]" }
          ]
        }
      });
    }

    let resolvedEndLongitude = endLongitude;
    let resolvedEndLatitude = endLatitude;
    let destination = null;

    if ((resolvedEndLongitude === null || resolvedEndLatitude === null) && destinationId) {
      destination = await Destination.findById(destinationId);
      if (!destination) {
        return res.status(404).json({ message: "Destination not found" });
      }

      resolvedEndLongitude = toNumber(destination.location.longitude);
      resolvedEndLatitude = toNumber(destination.location.latitude);
    }

    if (resolvedEndLongitude === null || resolvedEndLatitude === null) {
      return res.status(400).json({
        message: "Invalid payload. Provide destinationId or destination coordinates",
        expected: {
          destination: [
            { destinationId: "string" },
            { destinationLongitude: "number", destinationLatitude: "number" },
            { destination: { longitude: "number", latitude: "number" } },
            { coordinates: "[[originLng, originLat], [destinationLng, destinationLat]]" }
          ]
        }
      });
    }

    const route = await getRouteSummary({
      startLongitude,
      startLatitude,
      endLongitude: resolvedEndLongitude,
      endLatitude: resolvedEndLatitude,
      profile
    });

    res.json({
      route,
      destination: destination
        ? {
          id: destination._id,
          name: destination.name,
          location: destination.location
        }
        : {
          location: {
            longitude: resolvedEndLongitude,
            latitude: resolvedEndLatitude
          }
        }
    });
  } catch (err) {
    console.error("Single route error:", err);
    const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 502;
    res.status(statusCode >= 400 && statusCode < 500 ? statusCode : 502).json({
      message: "Mapbox route generation failed",
      details: err.providerMessage || err.message
    });
  }
};

/**
 * Get optimized route for multiple destinations
 */
exports.getOptimizedRoute = async (req, res) => {
  try {
    const {
      userLongitude,
      userLatitude,
      destinationIds,
      profile = 'mapbox/driving'
    } = req.body;

    if (!userLongitude || !userLatitude || !destinationIds || !Array.isArray(destinationIds)) {
      return res.status(400).json({
        message: "userLongitude, userLatitude, and destinationIds array are required"
      });
    }

    const destinations = await Destination.find({
      _id: { $in: destinationIds },
      isActive: true
    });

    if (!destinations.length) {
      return res.status(404).json({ message: "No valid destinations found" });
    }

    const optimizedRoute = await optimizeRoute({
      userLongitude: Number(userLongitude),
      userLatitude: Number(userLatitude),
      destinations,
      profile
    });

    res.json({
      optimizedRoute,
      destinations: optimizedRoute.optimizedOrder.map(dest => ({
        id: dest._id,
        name: dest.name,
        location: dest.location
      }))
    });
  } catch (err) {
    console.error("Route optimization error:", err);
    res.status(502).json({
      message: "Mapbox route optimization failed",
      details: err.message
    });
  }
};

/**
 * Get distance-sorted destinations from user location
 */
exports.getSortedDestinations = async (req, res) => {
  try {
    const {
      userLongitude,
      userLatitude,
      limit = 20,
      profile = 'mapbox/driving'
    } = req.query;

    if (!userLongitude || !userLatitude) {
      return res.status(400).json({
        message: "userLongitude and userLatitude are required"
      });
    }

    const destinations = await Destination.find({ isActive: true })
      .limit(parseInt(limit));

    if (!destinations.length) {
      return res.json([]);
    }

    const sortedDestinations = await sortDestinationsByDistance({
      userLongitude: Number(userLongitude),
      userLatitude: Number(userLatitude),
      destinations,
      profile
    });

    res.json(sortedDestinations);
  } catch (err) {
    console.error("Distance sorting error:", err);
    res.status(502).json({
      message: "Distance sorting failed",
      details: err.message
    });
  }
};

/**
 * Get route matrix for multiple destinations (for advanced analytics)
 */
exports.getRouteMatrix = async (req, res) => {
  try {
    const {
      userLongitude,
      userLatitude,
      destinationIds,
      profile = 'mapbox/driving'
    } = req.body;

    if (!userLongitude || !userLatitude || !destinationIds || !Array.isArray(destinationIds)) {
      return res.status(400).json({
        message: "userLongitude, userLatitude, and destinationIds array are required"
      });
    }

    const destinations = await Destination.find({
      _id: { $in: destinationIds },
      isActive: true
    });

    if (!destinations.length) {
      return res.status(404).json({ message: "No valid destinations found" });
    }

    const { getDistanceMatrix } = require("../services/mapboxService");
    
    const destinationCoords = destinations.map(dest => [
      dest.location.longitude,
      dest.location.latitude
    ]);

    const matrix = await getDistanceMatrix({
      origins: [[Number(userLongitude), Number(userLatitude)]],
      destinations: destinationCoords,
      profile
    });

    // Combine matrix data with destination info
    const destinationMatrix = destinations.map((dest, index) => ({
      destination: {
        id: dest._id,
        name: dest.name,
        location: dest.location
      },
      distanceFromUser: matrix.distances[0][index] || null,
      durationFromUser: matrix.durations[0][index] || null
    }));

    res.json({
      matrix: destinationMatrix,
      rawMatrix: matrix
    });
  } catch (err) {
    console.error("Route matrix error:", err);
    res.status(502).json({
      message: "Route matrix calculation failed",
      details: err.message
    });
  }
};
