// Handles itinerary creation and retrieval for users
const Itinerary = require("../models/Itinerary");
const mongoose = require("mongoose");
const {
  normalizeDays,
  splitDestinationsByDays
} = require("../utils/splitItineraryByDays");
const {
  sortDestinationsByDistance
} = require("../services/mapboxService");
const {
  normalizeCollaborators
} = require("../utils/collaboratorUtils");
const { createSystemLog } = require("../services/systemLogService");

async function logItineraryEvent(req, payload) {
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

exports.createItinerary = async (req, res) => {
  try {
    const {
      destinations,
      totalCost,
      maxBudget,
      budgetMode,
      isSaved,
      days,
      travelStyle,
      collaboratorIds,
      collaborators
    } = req.body;
    const parsedBudget = Number(maxBudget);
    const normalizedDays = normalizeDays(days);
    const normalizedBudgetMode = ["constrained", "unconstrained"].includes(budgetMode)
      ? budgetMode
      : Number.isFinite(parsedBudget)
        ? "constrained"
        : "unconstrained";
    const collaboratorResult = await normalizeCollaborators({
      currentUserId: req.user.id,
      travelStyle,
      collaboratorIds,
      collaborators
    });

    if (days !== undefined && normalizedDays === null) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary validation failed",
        description: "days must be a positive integer",
        status: "Failed"
      });
      return res.status(400).json({ message: "days must be a positive integer" });
    }

    if (!collaboratorResult.ok) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary validation failed",
        description: collaboratorResult.message,
        status: "Failed",
        metadata: { code: collaboratorResult.code }
      });
      return res.status(400).json({ message: collaboratorResult.message, code: collaboratorResult.code });
    }

    const destinationList = Array.isArray(destinations) ? destinations : [];
    const { dayPlans } = splitDestinationsByDays(destinationList, normalizedDays);

    const itinerary = await Itinerary.create({
      user: req.user.id,
      destinations: destinationList,
      days: normalizedDays,
      dayPlans,
      totalCost,
      maxBudget: Number.isFinite(parsedBudget) ? parsedBudget : null,
      budgetMode: normalizedBudgetMode,
      travelStyle: collaboratorResult.travelStyle,
      collaboratorIds: collaboratorResult.collaboratorIds,
      isSaved: Boolean(isSaved)
    });

    await logItineraryEvent(req, {
      severity: "Success",
      event: Boolean(isSaved) ? "Itinerary saved" : "Itinerary created",
      description: Boolean(isSaved)
        ? "User created and saved itinerary."
        : "User created itinerary.",
      status: "Success",
      metadata: { itineraryId: itinerary._id.toString() }
    });

    res.status(201).json(itinerary);
  } catch (err) {
    console.error(err);
    await logItineraryEvent(req, {
      severity: "Error",
      event: "Itinerary creation failed",
      description: err.message,
      status: "Failed"
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find({
      $and: [
        { $or: [{ user: req.user.id }, { collaboratorIds: req.user.id }] },
        { hiddenFor: { $ne: req.user.id } }
      ]
    })
      .populate("destinations.destination")
      .populate("dayPlans.destinations.destination")
      .populate("collaboratorIds", "_id fullName email");

    res.json(itineraries);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUserItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary validation failed",
        description: "Invalid itinerary ID",
        status: "Failed",
        metadata: { itineraryId: id }
      });
      return res.status(400).json({ message: "Invalid itinerary ID" });
    }

    const itinerary = await Itinerary.findOne({
      _id: id,
      $or: [{ user: userId }, { collaboratorIds: userId }]
    });

    if (!itinerary) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary delete failed",
        description: "Itinerary not found or access denied",
        status: "Failed",
        metadata: { itineraryId: id }
      });
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const isOwner = itinerary.user?.toString() === userId.toString();

    if (isOwner) {
      await Itinerary.deleteOne({ _id: id });

      await logItineraryEvent(req, {
        severity: "Info",
        event: "Itinerary deleted",
        description: "Owner deleted itinerary for all users.",
        status: "Success",
        metadata: { itineraryId: id }
      });

      return res.json({ message: "Itinerary deleted successfully" });
    }

    await Itinerary.updateOne(
      { _id: id },
      {
        $addToSet: { hiddenFor: userId },
        $pull: { collaboratorIds: userId }
      }
    );

    await logItineraryEvent(req, {
      severity: "Info",
      event: "Itinerary removed",
      description: "Collaborator removed itinerary from own account.",
      status: "Success",
      metadata: { itineraryId: id }
    });

    return res.json({ message: "Itinerary removed from your account" });
  } catch (err) {
    await logItineraryEvent(req, {
      severity: "Error",
      event: "Itinerary delete failed",
      description: err.message,
      status: "Failed",
      metadata: { itineraryId: req.params.id }
    });
    res.status(500).json({ message: "Server error" });
  }
};

const {
  getHybridRecommendations,
  getGroupHybridRecommendations
} = require("../services/recommendation/hybrid");
const {
  knapsackOptimize
} = require("../services/recommendation/knapsack");

/**
 * Generate itinerary using Hybrid Recommendation + Knapsack Optimization + Distance-Based Sorting
 */
exports.generateItinerary = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      maxBudget,
      days,
      userLongitude,
      userLatitude,
      travelStyle,
      collaboratorIds,
      collaborators
    } = req.body;
    const normalizedDays = normalizeDays(days);
    const collaboratorResult = await normalizeCollaborators({
      currentUserId: req.user.id,
      travelStyle,
      collaboratorIds,
      collaborators
    });

    if (!maxBudget) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: "maxBudget is required",
        status: "Failed"
      });
      return res.status(400).json({ message: "maxBudget is required" });
    }

    if (days !== undefined && normalizedDays === null) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: "days must be a positive integer",
        status: "Failed"
      });
      return res.status(400).json({ message: "days must be a positive integer" });
    }

    if (!collaboratorResult.ok) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Generate itinerary validation failed",
        description: collaboratorResult.message,
        status: "Failed",
        metadata: { code: collaboratorResult.code }
      });
      return res.status(400).json({ message: collaboratorResult.message, code: collaboratorResult.code });
    }

    // 1) Get hybrid recommendations
    const participantIds = [userId, ...collaboratorResult.collaboratorIds];
    const hybridResults = participantIds.length > 1
      ? await getGroupHybridRecommendations(participantIds, {
        travelStyle: collaboratorResult.travelStyle
      })
      : await getHybridRecommendations(userId);

    if (!hybridResults.length) {
      return res.status(200).json({
        message: "No recommendations available",
        itinerary: []
      });
    }

    // 2) Apply distance-based sorting if user location is provided
    let sortedResults = hybridResults;
    if (userLongitude && userLatitude && process.env.MAPBOX_SERVER_TOKEN) {
      try {
        const destinations = hybridResults.map(item => item.destination);
        const sortedDestinations = await sortDestinationsByDistance({
          userLongitude: Number(userLongitude),
          userLatitude: Number(userLatitude),
          destinations,
          profile: 'mapbox/driving'
        });

        // Map sorted destinations back to hybrid results format
        const destinationMap = new Map();
        hybridResults.forEach(item => {
          destinationMap.set(item.destination._id.toString(), item);
        });

        sortedResults = sortedDestinations
          .map(dest => {
            const originalItem = destinationMap.get(dest._id.toString());
            if (originalItem) {
              return {
                ...originalItem,
                destination: dest,
                distanceFromUser: dest.distanceFromUser,
                durationFromUser: dest.durationFromUser
              };
            }
            return null;
          })
          .filter(Boolean);
      } catch (distanceErr) {
        console.error("Distance sorting failed, using original order:", distanceErr);
        // Continue with original hybrid results if distance sorting fails
      }
    }

    // 3) Apply knapsack optimization
    const optimized = knapsackOptimize(sortedResults, maxBudget);

    // 4) Compute total cost
    const totalCost = optimized.reduce(
      (sum, item) => sum + item.destination.estimatedCost,
      0
    );

    // 5) Prepare itinerary destinations
    const destinations = optimized.map((item) => ({
      destination: item.destination._id,
      cost: item.destination.estimatedCost,
      hybridScore: item.score,
      distanceFromUser: item.destination.distanceFromUser || null,
      durationFromUser: item.destination.durationFromUser || null
    }));
    const { dayPlans } = splitDestinationsByDays(destinations, normalizedDays);

    // 6) Save itinerary
    const itinerary = await Itinerary.create({
      user: userId,
      destinations,
      days: normalizedDays,
      dayPlans,
      totalCost,
      maxBudget,
      travelStyle: collaboratorResult.travelStyle,
      collaboratorIds: collaboratorResult.collaboratorIds,
      isSaved: true,
      budgetMode: "constrained"
    });

    await logItineraryEvent(req, {
      severity: "Success",
      event: "Itinerary generated",
      description: "User generated itinerary with recommendations.",
      status: "Success",
      metadata: { itineraryId: itinerary._id.toString() }
    });

    res.status(201).json(itinerary);
  } catch (err) {
    console.error(err);
    await logItineraryEvent(req, {
      severity: "Error",
      event: "Generate itinerary failed",
      description: err.message,
      status: "Failed"
    });
    res.status(500).json({ message: "Server error" });
  }
};
