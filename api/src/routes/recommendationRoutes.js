const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const {
  getCBFRecommendations,
  generateItinerary
} = require("../controllers/recommendationController");

router.get("/cbf", auth, getCBFRecommendations);
router.post("/itinerary", auth, generateItinerary);

module.exports = router;
