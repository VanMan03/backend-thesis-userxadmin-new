const express = require("express");
const router = express.Router();
const {
  createItinerary,
  getUserItineraries,
  deleteUserItinerary,
  updateItinerary
} = require("../controllers/itineraryController");
const {
  generateItineraryBudgetOptimized
} = require("../controllers/recommendationController");

const auth = require("../middleware/authMiddleware");

router.post("/", auth, createItinerary);
router.get("/", auth, getUserItineraries);
router.post("/generate", auth, generateItineraryBudgetOptimized);
router.patch("/:id", auth, updateItinerary);
router.delete("/:id", auth, deleteUserItinerary);

module.exports = router;
