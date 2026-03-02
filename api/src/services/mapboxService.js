const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
const mbxMatrix = require('@mapbox/mapbox-sdk/services/matrix');
const mbxOptimization = require('@mapbox/mapbox-sdk/services/optimization');
const fetch = require('node-fetch');

function getAccessToken() {
  const accessToken = process.env.MAPBOX_SERVER_TOKEN;
  if (!accessToken) {
    throw new Error('MAPBOX_SERVER_TOKEN is missing from environment variables');
  }
  return accessToken;
}

// Initialize Mapbox clients
const geocodingClient = mbxGeocoding({ accessToken: getAccessToken() });
const directionsClient = mbxDirections({ accessToken: getAccessToken() });
const matrixClient = mbxMatrix({ accessToken: getAccessToken() });
const optimizationClient = mbxOptimization({ accessToken: getAccessToken() });

/**
 * Reverse geocode coordinates to get address components
 * @param {number} longitude 
 * @param {number} latitude 
 * @returns {Promise<Object>} Resolved address with barangay, city, province
 */
async function reverseGeocode(longitude, latitude) {
  try {
    const response = await geocodingClient
      .reverseGeocode({
        query: [longitude, latitude],
        limit: 1,
        types: ['address', 'place', 'region', 'country']
      })
      .send();

    const feature = response.body.features[0];
    if (!feature) {
      return null;
    }

    const context = feature.context || [];
    const addressComponents = {
      fullAddress: feature.place_name || '',
      barangay: '',
      city: '',
      province: '',
      country: '',
      postcode: ''
    };

    // Parse context to extract address components
    context.forEach(item => {
      const id = item.id || '';
      if (id.startsWith('address.')) {
        addressComponents.barangay = item.text || '';
      } else if (id.startsWith('place.')) {
        addressComponents.city = item.text || '';
      } else if (id.startsWith('region.')) {
        addressComponents.province = item.text || '';
      } else if (id.startsWith('country.')) {
        addressComponents.country = item.text || '';
      } else if (id.startsWith('postcode.')) {
        addressComponents.postcode = item.text || '';
      }
    });

    return addressComponents;
  } catch (error) {
    console.error('Mapbox reverse geocoding error:', error);
    throw new Error(`Mapbox reverse geocode failed: ${error.message}`);
  }
}

/**
 * Get route summary between two points
 * @param {Object} params 
 * @returns {Promise<Object>} Route information with distance, duration, and geometry
 */
async function getRouteSummary({
  startLongitude,
  startLatitude,
  endLongitude,
  endLatitude,
  profile = 'mapbox/driving'
}) {
  try {
    const response = await directionsClient
      .getDirections({
        profile,
        waypoints: [
          { coordinates: [startLongitude, startLatitude] },
          { coordinates: [endLongitude, endLatitude] }
        ],
        geometries: 'geojson',
        steps: false
      })
      .send();

    const route = response.body.routes[0];
    if (!route) {
      throw new Error('No route found');
    }

    return {
      distanceMeters: route.distance || null,
      durationSeconds: route.duration || null,
      geometry: route.geometry || null,
      legs: route.legs || []
    };
  } catch (error) {
    console.error('Mapbox directions error:', error);
    throw new Error(`Mapbox directions failed: ${error.message}`);
  }
}

/**
 * Get travel times/distances from origin to multiple destinations
 * @param {Object} params 
 * @returns {Promise<Array>} Matrix with distances and durations
 */
async function getDistanceMatrix({
  origins, // Array of [lng, lat] coordinates
  destinations, // Array of [lng, lat] coordinates
  profile = 'mapbox/driving'
}) {
  try {
    const response = await matrixClient
      .getMatrix({
        profile,
        points: [...origins, ...destinations],
        sources: origins.map((_, index) => index),
        destinations: destinations.map((_, index) => origins.length + index)
      })
      .send();

    const matrix = response.body;
    if (!matrix || !matrix.distances || !matrix.durations) {
      throw new Error('Invalid matrix response');
    }

    return {
      distances: matrix.distances,
      durations: matrix.durations
    };
  } catch (error) {
    console.error('Mapbox matrix error:', error);
    throw new Error(`Mapbox matrix failed: ${error.message}`);
  }
}

/**
 * Sort destinations by distance from user location
 * @param {Object} params 
 * @returns {Promise<Array>} Sorted destinations with distance info
 */
async function sortDestinationsByDistance({
  userLongitude,
  userLatitude,
  destinations, // Array of destination objects with location
  profile = 'mapbox/driving'
}) {
  try {
    if (!destinations.length) {
      return [];
    }

    const destinationCoords = destinations.map(dest => [
      dest.location.longitude,
      dest.location.latitude
    ]);

    const matrix = await getDistanceMatrix({
      origins: [[userLongitude, userLatitude]],
      destinations: destinationCoords,
      profile
    });

    const distances = matrix.distances[0]; // First row = distances from user to each destination
    const durations = matrix.durations[0]; // First row = durations from user to each destination

    // Combine destinations with their distance/duration info
    const destinationsWithDistance = destinations.map((dest, index) => ({
      ...dest.toObject ? dest.toObject() : dest,
      distanceFromUser: distances[index] || null,
      durationFromUser: durations[index] || null
    }));

    // Sort by distance (null values go to end)
    destinationsWithDistance.sort((a, b) => {
      if (a.distanceFromUser === null) return 1;
      if (b.distanceFromUser === null) return -1;
      return a.distanceFromUser - b.distanceFromUser;
    });

    return destinationsWithDistance;
  } catch (error) {
    console.error('Distance sorting error:', error);
    throw new Error(`Distance sorting failed: ${error.message}`);
  }
}

/**
 * Optimize route for visiting multiple destinations
 * @param {Object} params 
 * @returns {Promise<Object>} Optimized route with order and geometry
 */
async function optimizeRoute({
  userLongitude,
  userLatitude,
  destinations, // Array of destination objects with location
  profile = 'mapbox/driving'
}) {
  try {
    if (!destinations.length) {
      return {
        optimizedOrder: [],
        geometry: null,
        totalDistance: null,
        totalDuration: null
      };
    }

    // Prepare coordinates for optimization
    const coordinates = [
      [userLongitude, userLatitude], // Start point
      ...destinations.map(dest => [dest.location.longitude, dest.location.latitude])
    ];

    const response = await optimizationClient
      .getOptimization({
        profile,
        coordinates,
        source: 'first', // Start from first coordinate (user location)
        destination: 'last', // End at last coordinate (if needed)
        geometries: 'geojson'
      })
      .send();

    const optimization = response.body;
    if (!optimization.trips || !optimization.trips.length) {
      throw new Error('No optimization found');
    }

    const trip = optimization.trips[0];
    
    // Map optimized order back to destinations
    const optimizedOrder = trip.waypoints
      .filter(wp => wp.waypoint_index > 0) // Skip origin (index 0)
      .map(wp => destinations[wp.waypoint_index - 1]);

    return {
      optimizedOrder,
      geometry: trip.geometry || null,
      totalDistance: trip.distance || null,
      totalDuration: trip.duration || null,
      waypoints: trip.waypoints || []
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    throw new Error(`Route optimization failed: ${error.message}`);
  }
}

module.exports = {
  reverseGeocode,
  getRouteSummary,
  getDistanceMatrix,
  sortDestinationsByDistance,
  optimizeRoute
};
