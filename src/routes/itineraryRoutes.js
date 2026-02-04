const express = require("express");
const router = express.Router();
const {
  createItinerary,
  getUserItineraries
} = require("../controllers/itineraryController");

const auth = require("../middleware/authMiddleware");

router.post("/", auth, createItinerary);
router.get("/", auth, getUserItineraries);

module.exports = router;

const { generateItinerary } = require("../controllers/itineraryController");

router.post("/generate", auth, generateItinerary);
