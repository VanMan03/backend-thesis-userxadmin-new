const express = require('express');
const router = express.Router();
const {
  getSingleRoute,
  getOptimizedRoute,
  getSortedDestinations,
  getRouteMatrix
} = require('../controllers/routeController');

// Route between user and single destination
router.post('/single', getSingleRoute);

// Optimized route for multiple destinations
router.post('/optimize', getOptimizedRoute);

// Get destinations sorted by distance from user
router.get('/sorted', getSortedDestinations);

// Get route matrix for analytics
router.post('/matrix', getRouteMatrix);

module.exports = router;
