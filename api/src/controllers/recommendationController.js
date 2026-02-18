const {
  getContentBasedRecommendations
} = require("../services/recommendation/contentBased");

const {
  getHybridRecommendations
} = require("../services/recommendation/hybrid");

const {
  knapsackOptimize
} = require("../services/recommendation/knapsack");

const RecommendationFeedback = require("../models/RecommendationFeedback");
const Destination = require("../models/Destination");

const FEEDBACK_EVENT_TYPES = new Set([
  "recommendation_requested",
  "recommendation_impression",
  "destination_added",
  "destination_removed",
  "itinerary_saved",
  "saved_itinerary_viewed",
  "saved_itinerary_updated",
  "saved_itinerary_deleted"
]);

function normalizeFeedbackEvent(event, fallbackUserId = null) {
  if (!event || typeof event !== "object") return null;

  if (!FEEDBACK_EVENT_TYPES.has(event.eventType)) {
    return null;
  }

  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  if (!event.sessionId || typeof event.sessionId !== "string") {
    return null;
  }

  return {
    eventType: event.eventType,
    timestamp,
    sessionId: event.sessionId,
    userId: event.userId || fallbackUserId || null,
    userEmail: event.userEmail || null,
    destinationId: event.destinationId || null,
    itineraryId: event.itineraryId || null,
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  };
}

/**
 * Content-Based Filtering recommendations (baseline)
 */
exports.getCBFRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;

    const recommendations = await getContentBasedRecommendations(userId);

    res.json(
      recommendations.map((item) => ({
        destination: item.destination,
        score: item.score
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Generate itinerary using Hybrid + Knapsack
 */
exports.generateItinerary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { budgetMode, maxBudget } = req.body;
    const parsedBudget = Number(maxBudget);

    if (!["constrained", "unconstrained"].includes(budgetMode)) {
      return res.status(400).json({
        message: "budgetMode must be constrained or unconstrained"
      });
    }

    const hybridResults = await getHybridRecommendations(userId);
    let candidateResults = hybridResults;

    // Fallback for new users/no interaction history.
    if (!candidateResults.length) {
      const fallbackDestinations = await Destination.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(50);

      candidateResults = fallbackDestinations.map((destination) => ({
        destination,
        score: 0
      }));
    }

    if (!candidateResults.length) {
      return res.status(200).json({
        mode: budgetMode,
        totalCost: 0,
        recommendations: [],
        itinerary: null,
        message: "No active destinations available"
      });
    }

    let finalResults = candidateResults;

    if (budgetMode === "constrained") {
      if (!Number.isFinite(parsedBudget)) {
        return res.status(400).json({
          message: "Budget is required for constrained mode"
        });
      }

      finalResults = knapsackOptimize(candidateResults, parsedBudget);
    }

    const totalCost = finalResults.reduce(
      (sum, item) => sum + (item.destination.estimatedCost || 0),
      0
    );

    const itinerary = {
      user: userId,
      destinations: finalResults.map((item) => ({
        destination: item.destination._id,
        cost: item.destination.estimatedCost || 0,
        hybridScore: item.score
      })),
      totalCost,
      maxBudget: budgetMode === "constrained" ? parsedBudget : null,
      budgetMode,
      isSaved: false
    };

    res.json({
      mode: budgetMode,
      totalCost,
      recommendations: finalResults.map((item) => ({
        destination: item.destination,
        score: item.score
      })),
      itinerary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Single feedback event ingest
 * POST /api/recommendations/feedback
 */
exports.createFeedbackEvent = async (req, res) => {
  try {
    const fallbackUserId = req.user?.id || null;
    const normalized = normalizeFeedbackEvent(req.body, fallbackUserId);

    if (!normalized) {
      return res.status(400).json({ message: "Invalid feedback payload" });
    }

    await RecommendationFeedback.create(normalized);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Batch feedback ingest
 * POST /api/recommendations/feedback/batch
 */
exports.createFeedbackBatch = async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!events.length) {
      return res.status(400).json({ message: "events[] is required" });
    }

    const fallbackUserId = req.user?.id || null;
    const normalizedEvents = events
      .map((event) => normalizeFeedbackEvent(event, fallbackUserId))
      .filter(Boolean);

    if (!normalizedEvents.length) {
      return res.status(400).json({ message: "No valid events found" });
    }

    await RecommendationFeedback.insertMany(normalizedEvents, { ordered: false });

    return res.status(201).json({
      ok: true,
      accepted: normalizedEvents.length
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
