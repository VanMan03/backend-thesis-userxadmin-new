# Mapbox Migration Guide

This document outlines the migration from OpenRouteService + Leaflet to Mapbox for unified mapping, location selection, and distance-based sorting.

## Overview

The migration provides:
- **Unified mapping solution** using Mapbox APIs
- **Distance-based itinerary ordering** using Mapbox Matrix API
- **Route optimization** using Mapbox Optimized Trips API
- **Enhanced address resolution** with detailed components (barangay, city, province)

## Backend Changes

### 1. New Dependencies
```bash
npm install mapbox-gl @mapbox/mapbox-sdk
```

### 2. Environment Configuration
Add to your `.env` file:
```env
MAPBOX_SERVER_TOKEN=sk.your-mapbox-server-token-here
```

### 3. New Services
- `api/src/services/mapboxService.js` - Core Mapbox API integrations
- `api/src/controllers/routeController.js` - Route-specific endpoints
- `api/src/routes/routeRoutes.js` - Route API routes

### 4. Updated Controllers
- `adminController.js` - Uses Mapbox for address resolution and route preview
- `itineraryController.js` - Includes distance-based sorting in itinerary generation

### 5. Database Schema Updates
- **Destination model**: Enhanced `resolvedAddress` field with detailed components
- **Itinerary model**: Added `distanceFromUser` and `durationFromUser` fields

## API Endpoints

### New Route Endpoints

#### Get Single Route
```http
POST /api/routes/single
Content-Type: application/json

{
  "userLongitude": 120.9842,
  "userLatitude": 14.5995,
  "destinationId": "destination_id_here",
  "profile": "mapbox/driving"
}
```

Also accepted payload variants:

```json
{
  "profile": "driving",
  "originLongitude": 124.133,
  "originLatitude": 12.767,
  "destinationLongitude": 124.12345,
  "destinationLatitude": 12.6789
}
```

```json
{
  "profile": "walking",
  "coordinates": [
    [124.133, 12.767],
    [124.12345, 12.6789]
  ]
}
```

```json
{
  "profile": "cycling",
  "origin": { "longitude": 124.133, "latitude": 12.767 },
  "destination": { "longitude": 124.12345, "latitude": 12.6789 }
}
```

#### Get Optimized Route
```http
POST /api/routes/optimize
Content-Type: application/json

{
  "userLongitude": 120.9842,
  "userLatitude": 14.5995,
  "destinationIds": ["dest1", "dest2", "dest3"],
  "profile": "mapbox/driving"
}
```

#### Get Distance-Sorted Destinations
```http
GET /api/routes/sorted?userLongitude=120.9842&userLatitude=14.5995&limit=20
```

#### Get Route Matrix
```http
POST /api/routes/matrix
Content-Type: application/json

{
  "userLongitude": 120.9842,
  "userLatitude": 14.5995,
  "destinationIds": ["dest1", "dest2", "dest3"]
}
```

### Updated Endpoints

#### Generate Itinerary (Enhanced)
```http
POST /api/itineraries/generate
Content-Type: application/json

{
  "maxBudget": 5000,
  "days": 3,
  "userLongitude": 120.9842,  // NEW: Optional for distance-based sorting
  "userLatitude": 14.5995     // NEW: Optional for distance-based sorting
}
```

## Mapbox Service Functions

### Core Functions

1. **reverseGeocode(longitude, latitude)**
   - Returns detailed address components
   - Includes barangay, city, province, country, postcode

2. **getRouteSummary(params)**
   - Generates route between two points
   - Returns distance, duration, and geometry

3. **sortDestinationsByDistance(params)**
   - Sorts destinations by proximity to user
   - Uses Mapbox Matrix API for efficiency

4. **optimizeRoute(params)**
   - Optimizes visiting order for multiple destinations
   - Uses Mapbox Optimization API

## Frontend Integration

### Required Changes

1. **Update API calls** to use new endpoints
2. **Handle user location** for distance-based features
3. **Display distance/duration** information in itineraries
4. **Use Mapbox GL JS** for map rendering (replacing Leaflet)

### Example Frontend Integration

```javascript
// Get distance-sorted destinations
const getSortedDestinations = async (userLng, userLat) => {
  const response = await fetch(`/api/routes/sorted?userLongitude=${userLng}&userLatitude=${userLat}`);
  return response.json();
};

// Generate itinerary with distance sorting
const generateItinerary = async (budget, days, userLng, userLat) => {
  const response = await fetch('/api/itineraries/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxBudget: budget,
      days,
      userLongitude: userLng,
      userLatitude: userLat
    })
  });
  return response.json();
};
```

## Testing

### Run Mapbox Service Tests
```bash
# Set your Mapbox token
export MAPBOX_SERVER_TOKEN=sk.your_token_here

# Run tests
node api/test/mapboxService.test.js
```

### Test Individual Functions
```javascript
const { testMapboxServices } = require('./api/test/mapboxService.test.js');
testMapboxServices();
```

## Migration Checklist

- [ ] Set `MAPBOX_SERVER_TOKEN` in environment
- [ ] Install new dependencies
- [ ] Test Mapbox service functions
- [ ] Update frontend to use new endpoints
- [ ] Replace Leaflet with Mapbox GL JS
- [ ] Test distance-based itinerary generation
- [ ] Test route optimization features
- [ ] Remove OpenRouteService dependencies (optional)

## Benefits of Migration

1. **Unified Solution**: Single provider for all mapping needs
2. **Better Performance**: Mapbox's optimized APIs
3. **Enhanced Features**: Route optimization, detailed address resolution
4. **Consistent Experience**: Same styling and interaction patterns
5. **Scalability**: Mapbox's robust infrastructure

## Troubleshooting

### Common Issues

1. **Missing Token Error**
   ```
   MAPBOX_SERVER_TOKEN is missing from environment variables
   ```
   **Solution**: Set the environment variable in your `.env` file

2. **Invalid Token Error**
   ```
   Mapbox API authentication failed
   ```
   **Solution**: Verify your Mapbox server token has correct permissions

3. **Rate Limiting**
   ```
   Too many requests to Mapbox API
   ```
   **Solution**: Implement caching or upgrade your Mapbox plan

### Debug Mode

Enable debug logging:
```bash
DEBUG=mapbox* node your_app.js
```

## Support

For Mapbox-specific issues:
- [Mapbox Documentation](https://docs.mapbox.com/)
- [Mapbox API Reference](https://docs.mapbox.com/api/)
- [Mapbox Status Page](https://status.mapbox.com/)

For implementation issues, refer to the test files and service documentation.
