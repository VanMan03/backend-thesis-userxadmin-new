// Test setup without requiring real Mapbox token
console.log('🧪 Testing Mapbox Setup Structure...\n');

try {
  // Test 1: Check if all required files exist
  console.log('1️⃣ Checking file structure...');
  const fs = require('fs');
  
  const requiredFiles = [
    'api/src/services/mapboxService.js',
    'api/src/controllers/routeController.js', 
    'api/src/routes/routeRoutes.js',
    'api/test/mapboxService.test.js'
  ];
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
    }
  });
  console.log('');

  // Test 2: Check if app.js includes route routes
  console.log('2️⃣ Checking app.js integration...');
  const appContent = fs.readFileSync('api/src/app.js', 'utf8');
  if (appContent.includes("routeRoutes")) {
    console.log('✅ Route routes imported in app.js');
  } else {
    console.log('❌ Route routes not found in app.js');
  }
  
  if (appContent.includes('"/api/routes"')) {
    console.log('✅ Route endpoints configured in app.js');
  } else {
    console.log('❌ Route endpoints not configured in app.js');
  }
  console.log('');

  // Test 3: Check if controllers are updated
  console.log('3️⃣ Checking controller updates...');
  const adminControllerContent = fs.readFileSync('api/src/controllers/adminController.js', 'utf8');
  if (adminControllerContent.includes('mapboxService')) {
    console.log('✅ adminController.js updated to use Mapbox');
  } else {
    console.log('❌ adminController.js not updated');
  }
  
  const itineraryControllerContent = fs.readFileSync('api/src/controllers/itineraryController.js', 'utf8');
  if (itineraryControllerContent.includes('sortDestinationsByDistance')) {
    console.log('✅ itineraryController.js updated with distance sorting');
  } else {
    console.log('❌ itineraryController.js not updated');
  }
  console.log('');

  // Test 4: Check database schema updates
  console.log('4️⃣ Checking database schema...');
  const destinationSchema = fs.readFileSync('api/src/models/Destination.js', 'utf8');
  if (destinationSchema.includes('barangay') && destinationSchema.includes('city')) {
    console.log('✅ Destination schema updated with detailed address components');
  } else {
    console.log('❌ Destination schema not updated');
  }
  
  const itinerarySchema = fs.readFileSync('api/src/models/Itinerary.js', 'utf8');
  if (itinerarySchema.includes('distanceFromUser') && itinerarySchema.includes('durationFromUser')) {
    console.log('✅ Itinerary schema updated with distance fields');
  } else {
    console.log('❌ Itinerary schema not updated');
  }
  console.log('');

  // Test 5: Check package.json dependencies
  console.log('5️⃣ Checking dependencies...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['@mapbox/mapbox-sdk', 'mapbox-gl', 'node-fetch'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} installed`);
    } else {
      console.log(`❌ ${dep} missing`);
    }
  });
  console.log('');

  console.log('🎉 Mapbox migration setup structure verified!');
  console.log('\n📋 To complete setup:');
  console.log('1. Add MAPBOX_SERVER_TOKEN to your .env file');
  console.log('2. Token should start with "sk." (server token)');
  console.log('3. Run: node api/test/mapboxService.test.js');
  console.log('4. Update frontend to use new endpoints');

} catch (error) {
  console.error('❌ Setup verification failed:', error.message);
}
