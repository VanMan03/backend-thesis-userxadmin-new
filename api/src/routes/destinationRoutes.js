const express = require("express");
const router = express.Router();
const {
  getAllDestinations,
  getDestinationById,
  upsertDestinationRating,
  getMyDestinationRatings,
  clearDestinationRating
} = require("../controllers/destinationController");
const auth = require("../middleware/authMiddleware");

// Public (or optionally authenticated)
router.get("/", getAllDestinations);
router.get("/ratings/me", auth, getMyDestinationRatings);
router.post("/:destinationId/rating", auth, upsertDestinationRating);
router.delete("/:destinationId/rating", auth, clearDestinationRating);
router.get("/:id", getDestinationById);

module.exports = router;
