const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const { simpleRateLimit } = require("../middleware/simpleRateLimit");
const {
  getCBFRecommendations,
  generateItinerary,
  createFeedbackEvent,
  createFeedbackBatch
} = require("../controllers/recommendationController");

const feedbackRateLimit = simpleRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 120
});

router.get("/cbf", auth, getCBFRecommendations);
router.post("/itinerary", auth, generateItinerary);
router.post("/feedback", auth, feedbackRateLimit, createFeedbackEvent);
router.post("/feedback/batch", auth, feedbackRateLimit, createFeedbackBatch);

module.exports = router;
