// Simple setup verification without requiring actual Mapbox token
console.log('🔍 Verifying Mapbox Migration Setup...\n');

try {
  // Test 1: Check if dependencies are installed
  console.log('1️⃣ Checking dependencies...');
  const mapboxSdk = require('@mapbox/mapbox-sdk');
  console.log('✅ @mapbox/mapbox-sdk installed');
  
  const mapboxGl = require('mapbox-gl');
  console.log('✅ mapbox-gl installed');
  
  const nodeFetch = require('node-fetch');
  console.log('✅ node-fetch installed');
  console.log('');

  // Test 2: Check if service files exist and can be loaded (with mock token)
  console.log('2️⃣ Checking service files...');
  
  // Temporarily set a mock token for import testing
  const originalToken = process.env.MAPBOX_SERVER_TOKEN;
  process.env.MAPBOX_SERVER_TOKEN = 'pk.test-token-for-import-testing';
  
  try {
    // Clear require cache to force fresh import
    delete require.cache[require.resolve('../src/services/mapboxService')];
    const mapboxService = require('../src/services/mapboxService');
    console.log('✅ mapboxService.js loads successfully');
    
    // Check if all expected functions exist
    const expectedFunctions = ['reverseGeocode', 'getRouteSummary', 'sortDestinationsByDistance', 'optimizeRoute'];
    expectedFunctions.forEach(func => {
      if (typeof mapboxService[func] === 'function') {
        console.log(`   ✅ ${func} function exists`);
      } else {
        console.log(`   ❌ ${func} function missing`);
      }
    });
  } catch (importError) {
    console.log('❌ mapboxService.js import failed:', importError.message);
  }
  
  // Restore original token
  if (originalToken) {
    process.env.MAPBOX_SERVER_TOKEN = originalToken;
  } else {
    delete process.env.MAPBOX_SERVER_TOKEN;
  }
  console.log('');

  // Test 3: Check controller files
  console.log('3️⃣ Checking controller files...');
  try {
    const routeController = require('../src/controllers/routeController');
    console.log('✅ routeController.js loads successfully');
    
    const expectedControllerFunctions = ['getSingleRoute', 'getOptimizedRoute', 'getSortedDestinations', 'getRouteMatrix'];
    expectedControllerFunctions.forEach(func => {
      if (typeof routeController[func] === 'function') {
        console.log(`   ✅ ${func} controller function exists`);
      } else {
        console.log(`   ❌ ${func} controller function missing`);
      }
    });
  } catch (controllerError) {
    console.log('❌ routeController.js import failed:', controllerError.message);
  }
  console.log('');

  // Test 4: Check routes
  console.log('4️⃣ Checking route files...');
  try {
    const routeRoutes = require('../src/routes/routeRoutes');
    console.log('✅ routeRoutes.js loads successfully');
    console.log('   ✅ Route endpoints configured');
  } catch (routesError) {
    console.log('❌ routeRoutes.js import failed:', routesError.message);
  }
  console.log('');

  // Test 5: Check updated controllers
  console.log('5️⃣ Checking updated controllers...');
  try {
    const adminController = require('../src/controllers/adminController');
    console.log('✅ adminController.js loads successfully');
    
    const itineraryController = require('../src/controllers/itineraryController');
    console.log('✅ itineraryController.js loads successfully');
  } catch (controllerError) {
    console.log('❌ Updated controllers import failed:', controllerError.message);
  }
  console.log('');

  // Test 6: Check environment setup
  console.log('6️⃣ Checking environment setup...');
  if (process.env.MAPBOX_SERVER_TOKEN) {
    console.log('✅ MAPBOX_SERVER_TOKEN is set');
    if (process.env.MAPBOX_SERVER_TOKEN.startsWith('sk.')) {
      console.log('✅ Token format appears correct (starts with sk.)');
    } else {
      console.log('⚠️  Token format may be incorrect (should start with sk.)');
    }
  } else {
    console.log('❌ MAPBOX_SERVER_TOKEN is not set');
    console.log('   Please add it to your .env file: MAPBOX_SERVER_TOKEN=sk.your-token-here');
  }
  console.log('');

  console.log('🎉 Setup verification completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Ensure MAPBOX_SERVER_TOKEN is set in your .env file');
  console.log('2. The token should start with "sk." (server token)');
  console.log('3. Run the full test: node api/test/mapboxService.test.js');
  console.log('4. Update frontend to use new endpoints');

} catch (error) {
  console.error('❌ Setup verification failed:', error.message);
  console.error('Stack:', error.stack);
}
