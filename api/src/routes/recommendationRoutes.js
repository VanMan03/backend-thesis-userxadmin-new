const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const {
  getCBFRecommendations
} = require("../controllers/recommendationController");

// Content-Based Filtering recommendations
router.get("/cbf", auth, getCBFRecommendations);

module.exports = router;
