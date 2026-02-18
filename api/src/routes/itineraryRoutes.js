const express = require("express");
const router = express.Router();
const {
  createItinerary,
  getUserItineraries,
  deleteUserItinerary
} = require("../controllers/itineraryController");
const {
  generateItinerary: generateRecommendedItinerary
} = require("../controllers/recommendationController");

const auth = require("../middleware/authMiddleware");

router.post("/", auth, createItinerary);
router.get("/", auth, getUserItineraries);
router.post("/generate", auth, generateRecommendedItinerary);
router.delete("/:id", auth, deleteUserItinerary);

module.exports = router;
