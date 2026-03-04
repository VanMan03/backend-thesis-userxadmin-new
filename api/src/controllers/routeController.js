const {
  getRouteSummary,
  optimizeRoute,
  sortDestinationsByDistance
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

/**
 * Get route between user location and a single destination
 */
exports.getSingleRoute = async (req, res) => {
  try {
    const rawUserLongitude = resolveCoordinate(req.body, req.query, "userLongitude", [
      "longitude",
      "lng",
      "startLongitude",
      "startLng"
    ]);
    const rawUserLatitude = resolveCoordinate(req.body, req.query, "userLatitude", [
      "latitude",
      "lat",
      "startLatitude",
      "startLat"
    ]);
    const destinationId = resolveDestinationId(req.body);
    const profile = req.body?.profile || req.query?.profile || "mapbox/driving";
    const userLongitude = toNumber(rawUserLongitude);
    const userLatitude = toNumber(rawUserLatitude);

    if (userLongitude === null || userLatitude === null || !destinationId) {
      return res.status(400).json({
        message: "Invalid payload. userLongitude, userLatitude, and destinationId are required",
        expected: {
          userLongitude: "number",
          userLatitude: "number",
          destinationId: "string"
        }
      });
    }

    const destination = await Destination.findById(destinationId);
    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const route = await getRouteSummary({
      startLongitude: userLongitude,
      startLatitude: userLatitude,
      endLongitude: destination.location.longitude,
      endLatitude: destination.location.latitude,
      profile
    });

    res.json({
      route,
      destination: {
        id: destination._id,
        name: destination.name,
        location: destination.location
      }
    });
  } catch (err) {
    console.error("Single route error:", err);
    res.status(502).json({
      message: "Mapbox route generation failed",
      details: err.message
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
