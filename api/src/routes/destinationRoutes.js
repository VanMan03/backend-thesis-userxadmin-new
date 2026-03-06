const express = require("express");
const router = express.Router();
const {
  getAllDestinations,
  getDestinationById,
  upsertDestinationRating,
  getMyDestinationRatings,
  clearDestinationRating,
  getDestinationComments,
  createDestinationComment
} = require("../controllers/destinationController");
const auth = require("../middleware/authMiddleware");
const { simpleRateLimit } = require("../middleware/simpleRateLimit");

const ratingWriteRateLimit = simpleRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30
});

const commentWriteRateLimit = simpleRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20
});

// Public (or optionally authenticated)
router.get("/", getAllDestinations);
router.get("/ratings/me", auth, getMyDestinationRatings);
router.post("/:destinationId/rating", auth, ratingWriteRateLimit, upsertDestinationRating);
router.delete("/:destinationId/rating", auth, ratingWriteRateLimit, clearDestinationRating);
router.get("/:destinationId/comments", getDestinationComments);
router.post("/:destinationId/comments", auth, commentWriteRateLimit, createDestinationComment);
router.get("/:id", getDestinationById);

module.exports = router;
