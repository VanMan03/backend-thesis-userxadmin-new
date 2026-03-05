const {
  getContentBasedRecommendations
} = require("../services/recommendation/contentBased");

const {
  getHybridRecommendations,
  getGroupHybridRecommendations
} = require("../services/recommendation/hybrid");

const {
  knapsackOptimize
} = require("../services/recommendation/knapsack");

const RecommendationFeedback = require("../models/RecommendationFeedback");
const Destination = require("../models/Destination");
const Rating = require("../models/Rating");
const mongoose = require("mongoose");
const { createSystemLog } = require("../services/systemLogService");
const {
  normalizeDays,
  splitDestinationsByDays
} = require("../utils/splitItineraryByDays");
const {
  normalizeCollaborators
} = require("../utils/collaboratorUtils");

const FEEDBACK_EVENT_TYPES = new Set([
  "recommendation_requested",
  "recommendation_impression",
  "destination_rated",
  "destination_added",
  "destination_removed",
  "itinerary_saved",
  "saved_itinerary_viewed",
  "saved_itinerary_updated",
  "saved_itinerary_deleted"
]);

const ITINERARY_EVENT_TO_LOG = {
  itinerary_saved: {
    severity: "Success",
    event: "Itinerary saved",
    status: "Success"
  },
  saved_itinerary_viewed: {
    severity: "Info",
    event: "Saved itinerary viewed",
    status: "Success"
  },
  saved_itinerary_updated: {
    severity: "Info",
    event: "Saved itinerary updated",
    status: "Success"
  },
  saved_itinerary_deleted: {
    severity: "Warning",
    event: "Saved itinerary deleted",
    status: "Warning"
  }
};

async function logRecommendationEvent(req, payload) {
  await createSystemLog({
    ...payload,
    actorId: req.user?.id || null,
    actorRole: req.user?.role || "user",
    metadata: {
      path: req.originalUrl,
      method: req.method,
      ...(payload.metadata || {})
    }
  });
}

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

async function upsertRatingFromFeedbackEvent(event, fallbackUserId = null) {
  if (event.eventType !== "destination_rated") return;

  const destinationId = event.destinationId || event.metadata?.destinationId || null;
  const rating = event.metadata?.rating;
  const userId = event.userId || fallbackUserId || null;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error("destination_rated event requires a valid userId");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(destinationId)) {
    const err = new Error("destination_rated event requires a valid destinationId");
    err.status = 400;
    throw err;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const err = new Error("destination_rated event requires metadata.rating between 1 and 5");
    err.status = 400;
    throw err;
  }

  const destinationExists = await Destination.exists({ _id: destinationId, isActive: true });
  if (!destinationExists) {
    const err = new Error("destination_rated event destination not found");
    err.status = 400;
    throw err;
  }

  await Rating.findOneAndUpdate(
    { user: userId, destination: destinationId },
    { $set: { rating } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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
    const {
      budgetMode,
      maxBudget,
      days,
      travelStyle,
      collaboratorIds,
      collaborators
    } = req.body;
    const parsedBudget = Number(maxBudget);
    const normalizedDays = normalizeDays(days);
    const collaboratorResult = await normalizeCollaborators({
      currentUserId: userId,
      travelStyle,
      collaboratorIds,
      collaborators
    });

    if (!["constrained", "unconstrained"].includes(budgetMode)) {
      await logRecommendationEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: "budgetMode must be constrained or unconstrained",
        status: "Failed"
      });
      return res.status(400).json({
        message: "budgetMode must be constrained or unconstrained"
      });
    }

    if (days !== undefined && normalizedDays === null) {
      await logRecommendationEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: "days must be a positive integer",
        status: "Failed"
      });
      return res.status(400).json({ message: "days must be a positive integer" });
    }

    if (!collaboratorResult.ok) {
      await logRecommendationEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: collaboratorResult.message,
        status: "Failed",
        metadata: { code: collaboratorResult.code }
      });
      return res.status(400).json({ message: collaboratorResult.message, code: collaboratorResult.code });
    }

    const participantIds = [userId, ...collaboratorResult.collaboratorIds];
    const hybridResults = participantIds.length > 1
      ? await getGroupHybridRecommendations(participantIds, {
        travelStyle: collaboratorResult.travelStyle
      })
      : await getHybridRecommendations(userId);
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
        await logRecommendationEvent(req, {
          severity: "Warning",
          event: "Generate itinerary validation failed",
          description: "Budget is required for constrained mode",
          status: "Failed"
        });
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
      travelStyle: collaboratorResult.travelStyle,
      collaboratorIds: collaboratorResult.collaboratorIds,
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
    const { dayPlans } = await splitDestinationsByDays(itinerary.destinations, normalizedDays, userId);
    itinerary.days = normalizedDays;
    itinerary.dayPlans = dayPlans;

    await logRecommendationEvent(req, {
      severity: "Info",
      event: "Itinerary recommendations generated",
      description: "User generated itinerary recommendations.",
      status: "Success",
      metadata: { budgetMode, days: normalizedDays }
    });

    res.json({
      mode: budgetMode,
      totalCost,
      days: normalizedDays,
      travelStyle: collaboratorResult.travelStyle,
      collaboratorIds: collaboratorResult.collaboratorIds,
      recommendations: finalResults.map((item) => ({
        destination: item.destination,
        score: item.score
      })),
      itinerary
    });
  } catch (err) {
    console.error(err);
    await logRecommendationEvent(req, {
      severity: "Error",
      event: "Generate itinerary failed",
      description: err.message,
      status: "Failed"
    });
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
    await upsertRatingFromFeedbackEvent(normalized, fallbackUserId);

    const mapped = ITINERARY_EVENT_TO_LOG[normalized.eventType];
    if (mapped) {
      await logRecommendationEvent(req, {
        severity: mapped.severity,
        event: mapped.event,
        description: `Feedback event '${normalized.eventType}' received.`,
        status: mapped.status,
        metadata: {
          eventType: normalized.eventType,
          itineraryId: normalized.itineraryId || null,
          destinationId: normalized.destinationId || null,
          sessionId: normalized.sessionId
        }
      });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    await logRecommendationEvent(req, {
      severity: "Error",
      event: "Feedback ingest failed",
      description: err.message,
      status: "Failed"
    });
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

    for (const event of normalizedEvents) {
      // Keep batch behavior deterministic: fail the request if a destination_rated event is invalid.
      await upsertRatingFromFeedbackEvent(event, fallbackUserId);
    }

    const itineraryEvents = normalizedEvents.filter(
      (event) => ITINERARY_EVENT_TO_LOG[event.eventType]
    );
    if (itineraryEvents.length) {
      await logRecommendationEvent(req, {
        severity: "Info",
        event: "Itinerary feedback batch received",
        description: `Received ${itineraryEvents.length} itinerary-related feedback events.`,
        status: "Success",
        metadata: {
          totalAccepted: normalizedEvents.length,
          itineraryEventTypes: Array.from(new Set(itineraryEvents.map((e) => e.eventType)))
        }
      });
    }

    return res.status(201).json({
      ok: true,
      accepted: normalizedEvents.length
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    await logRecommendationEvent(req, {
      severity: "Error",
      event: "Feedback batch ingest failed",
      description: err.message,
      status: "Failed"
    });
    return res.status(500).json({ message: "Server error" });
  }
};
