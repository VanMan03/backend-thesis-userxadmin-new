const express = require("express");
const router = express.Router();
const {
  createItinerary,
  getUserItineraries,
  generateItinerary,
  deleteUserItinerary
} = require("../controllers/itineraryController");

const auth = require("../middleware/authMiddleware");

router.post("/", auth, createItinerary);
router.get("/", auth, getUserItineraries);
router.post("/generate", auth, generateItinerary);
router.delete("/:id", auth, deleteUserItinerary);

module.exports = router;
