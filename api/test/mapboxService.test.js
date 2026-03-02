const {
  reverseGeocode,
  getRouteSummary,
  sortDestinationsByDistance,
  optimizeRoute
} = require('../src/services/mapboxService');

// Test coordinates (Manila area)
const TEST_COORDS = {
  manila: { longitude: 120.9842, latitude: 14.5995 },
  quezonCity: { longitude: 121.0244, latitude: 14.6760 },
  makati: { longitude: 121.0244, latitude: 14.5547 }
};

// Mock destination data for testing
const mockDestinations = [
  {
    _id: 'dest1',
    name: 'Test Destination 1',
    location: TEST_COORDS.quezonCity
  },
  {
    _id: 'dest2', 
    name: 'Test Destination 2',
    location: TEST_COORDS.makati
  }
];

async function testMapboxServices() {
  console.log('🧪 Testing Mapbox Services...\n');

  try {
    // Test 1: Reverse Geocoding
    console.log('1️⃣ Testing Reverse Geocoding...');
    const address = await reverseGeocode(TEST_COORDS.manila.longitude, TEST_COORDS.manila.latitude);
    console.log('✅ Reverse Geocoding Result:', JSON.stringify(address, null, 2));
    console.log('');

    // Test 2: Route Summary
    console.log('2️⃣ Testing Route Summary...');
    const route = await getRouteSummary({
      startLongitude: TEST_COORDS.manila.longitude,
      startLatitude: TEST_COORDS.manila.latitude,
      endLongitude: TEST_COORDS.quezonCity.longitude,
      endLatitude: TEST_COORDS.quezonCity.latitude
    });
    console.log('✅ Route Summary Result:', JSON.stringify(route, null, 2));
    console.log('');

    // Test 3: Distance Sorting
    console.log('3️⃣ Testing Distance Sorting...');
    const sortedDestinations = await sortDestinationsByDistance({
      userLongitude: TEST_COORDS.manila.longitude,
      userLatitude: TEST_COORDS.manila.latitude,
      destinations: mockDestinations
    });
    console.log('✅ Distance Sorting Result:');
    sortedDestinations.forEach((dest, index) => {
      console.log(`   ${index + 1}. ${dest.name} - Distance: ${dest.distanceFromUser}m, Duration: ${dest.durationFromUser}s`);
    });
    console.log('');

    // Test 4: Route Optimization
    console.log('4️⃣ Testing Route Optimization...');
    const optimizedRoute = await optimizeRoute({
      userLongitude: TEST_COORDS.manila.longitude,
      userLatitude: TEST_COORDS.manila.latitude,
      destinations: mockDestinations
    });
    console.log('✅ Route Optimization Result:');
    console.log(`   Total Distance: ${optimizedRoute.totalDistance}m`);
    console.log(`   Total Duration: ${optimizedRoute.totalDuration}s`);
    console.log('   Optimized Order:');
    optimizedRoute.optimizedOrder.forEach((dest, index) => {
      console.log(`     ${index + 1}. ${dest.name}`);
    });
    console.log('');

    console.log('🎉 All Mapbox service tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  // Check for MAPBOX_SERVER_TOKEN
  if (!process.env.MAPBOX_SERVER_TOKEN) {
    console.error('❌ MAPBOX_SERVER_TOKEN environment variable is required');
    console.log('Please set it and try again:');
    console.log('export MAPBOX_SERVER_TOKEN=your_token_here');
    process.exit(1);
  }

  testMapboxServices();
}

module.exports = { testMapboxServices, TEST_COORDS, mockDestinations };
