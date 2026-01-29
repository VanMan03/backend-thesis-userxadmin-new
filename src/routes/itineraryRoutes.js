const express = require("express");
const router = express.Router();
const {
  createItinerary,
  getUserItineraries
} = require("../controllers/itineraryController");

const auth = require("../middleware/authmiddleware");

router.post("/", auth, createItinerary);
router.get("/", auth, getUserItineraries);

module.exports = router;
