const express = require("express");
const router = express.Router();
const {
  getAllDestinations,
  getDestinationById,
  upsertDestinationRating,
  getMyDestinationRatings
} = require("../controllers/destinationController");
const auth = require("../middleware/authMiddleware");

// Public (or optionally authenticated)
router.get("/", getAllDestinations);
router.get("/ratings/me", auth, getMyDestinationRatings);
router.post("/:destinationId/rating", auth, upsertDestinationRating);
router.get("/:id", getDestinationById);

module.exports = router;
