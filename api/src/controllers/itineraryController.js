// Handles itinerary creation and retrieval for users
const Itinerary = require("../models/Itinerary");
const CollaborationNotification = require("../models/CollaborationNotification");
const Destination = require("../models/Destination");
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  normalizeDays,
  splitDestinationsByDays
} = require("../utils/splitItineraryByDays");
const {
  extractDestinationId,
  validateAndNormalizeStops,
  buildFallbackStops
} = require("../utils/itineraryStops");
const {
  applySelectedDatesToItinerary
} = require("../utils/selectedDates");
const {
  sortDestinationsByDistance
} = require("../services/mapboxService");
const {
  normalizeCollaborators
} = require("../utils/collaboratorUtils");
const { createSystemLog } = require("../services/systemLogService");
const { broadcastItineraryEdit } = require("../services/collaborationRealtime");

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

function withResolvedStops(itineraryDoc) {
  const itinerary = itineraryDoc?.toObject ? itineraryDoc.toObject() : itineraryDoc;
  return {
    ...itinerary,
    stops: buildFallbackStops({
      stops: itinerary?.stops,
      destinations: itinerary?.destinations,
      dayPlans: itinerary?.dayPlans,
      days: itinerary?.days
    })
  };
}

function validateAndNormalizeName(nameInput, { required = false } = {}) {
  if (nameInput === undefined) {
    return required
      ? { ok: false, message: "name is required and cannot be empty" }
      : { ok: true, provided: false };
  }

  if (typeof nameInput !== "string") {
    return { ok: false, message: "name must be a non-empty string" };
  }

  const trimmedName = nameInput.trim();
  if (!trimmedName) {
    return { ok: false, message: "name is required and cannot be empty" };
  }

  return { ok: true, provided: true, value: trimmedName };
}

exports.createItinerary = async (req, res) => {
  try {
    const {
      name,
      destinations,
      stops,
      schedule,
      totalCost,
      maxBudget,
      budgetMode,
      isSaved,
      days,
      selectedDates,
      travelStyle,
      collaboratorIds,
      collaborators
    } = req.body;
    const nameValidation = validateAndNormalizeName(name, { required: true });
    if (!nameValidation.ok) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary validation failed",
        description: nameValidation.message,
        status: "Failed"
      });
      return res.status(400).json({ message: nameValidation.message });
    }
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

    const selectedDatesResult = applySelectedDatesToItinerary({
      selectedDatesInput: selectedDates,
      currentDays: null,
      daysInputProvided: days !== undefined,
      normalizedDays
    });

    if (selectedDatesResult.error) {
      await logItineraryEvent(req, {
        severity: "Warning",
        event: "Itinerary validation failed",
        description: selectedDatesResult.error,
        status: "Failed"
      });
      return res.status(400).json({ message: selectedDatesResult.error });
    }

    const resolvedDays = selectedDatesResult.days;

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
    const allowedDestinationIds = destinationList
      .map((item) => extractDestinationId(item?.destination || item))
      .filter(Boolean);
    const normalizedStopsResult = validateAndNormalizeStops({
      stopsInput: stops ?? schedule,
      allowedDestinationIds,
      tripDays: resolvedDays
    });
    if (!normalizedStopsResult.ok) {
      return res.status(400).json({ message: normalizedStopsResult.message });
    }

    const { dayPlans } = await splitDestinationsByDays(destinationList, resolvedDays, req.user.id);

    const itinerary = await Itinerary.create({
      user: req.user.id,
      name: nameValidation.value,
      destinations: destinationList,
      days: resolvedDays,
      selectedDates: selectedDatesResult.selectedDates,
      dayPlans,
      stops: normalizedStopsResult.provided ? normalizedStopsResult.stops : undefined,
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

    res.status(201).json(withResolvedStops(itinerary));
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

    res.json(itineraries.map(withResolvedStops));
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

exports.updateItinerary = async (req, res) => {
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
        event: "Itinerary update failed",
        description: "Itinerary not found or access denied",
        status: "Failed",
        metadata: { itineraryId: id }
      });
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const edit = {};
    const {
      name,
      tripDays,
      days,
      selectedDates,
      destinationIds,
      destinations,
      stops,
      schedule
    } = req.body;

    const nameValidation = validateAndNormalizeName(name);
    if (!nameValidation.ok) {
      return res.status(400).json({ message: nameValidation.message });
    }
    if (nameValidation.provided) {
      itinerary.name = nameValidation.value;
      edit.name = itinerary.name;
    }

    const daysInput = tripDays !== undefined ? tripDays : days;
    const normalizedDays = daysInput !== undefined ? normalizeDays(daysInput) : itinerary.days;
    if (daysInput !== undefined && normalizedDays === null) {
      return res.status(400).json({ message: "days must be a positive integer" });
    }

    const selectedDatesResult = applySelectedDatesToItinerary({
      selectedDatesInput: selectedDates,
      currentDays: itinerary.days,
      daysInputProvided: daysInput !== undefined,
      normalizedDays
    });
    if (selectedDatesResult.error) {
      return res.status(400).json({ message: selectedDatesResult.error });
    }

    if (daysInput !== undefined || selectedDatesResult.selectedDatesProvided) {
      itinerary.days = selectedDatesResult.days;
      edit.tripDays = selectedDatesResult.days;
    }

    if (selectedDatesResult.selectedDatesProvided) {
      itinerary.selectedDates = selectedDatesResult.selectedDates;
      edit.selectedDates = selectedDatesResult.selectedDates;
    }

    let resolvedDestinationIds = destinationIds;
    if (resolvedDestinationIds === undefined && Array.isArray(destinations)) {
      resolvedDestinationIds = destinations
        .map((item) => item?.destination?._id || item?.destination || item?.destinationId || item?._id)
        .filter(Boolean);
    }

    if (resolvedDestinationIds !== undefined) {
      if (!Array.isArray(resolvedDestinationIds)) {
        return res.status(400).json({ message: "destinationIds must be an array" });
      }

      const cleanedIds = [...new Set(resolvedDestinationIds.map((value) => value?.toString()).filter(Boolean))];
      const validIds = cleanedIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
      if (cleanedIds.length !== validIds.length) {
        return res.status(400).json({ message: "destinationIds contains invalid IDs" });
      }

      const destinationDocs = await Destination.find({
        _id: { $in: validIds },
        isActive: true
      }).select("_id estimatedCost");

      const destinationMap = new Map(destinationDocs.map((d) => [d._id.toString(), d]));
      const itineraryDestinations = validIds
        .filter((destId) => destinationMap.has(destId))
        .map((destId) => ({
          destination: destId,
          cost: destinationMap.get(destId).estimatedCost || 0
        }));

      itinerary.destinations = itineraryDestinations;
      itinerary.totalCost = itineraryDestinations.reduce((sum, item) => sum + (item.cost || 0), 0);
      edit.destinationIds = itineraryDestinations.map((item) => item.destination.toString());
    }

    const allowedDestinationIds = itinerary.destinations
      .map((item) => extractDestinationId(item?.destination || item))
      .filter(Boolean);
    const normalizedStopsResult = validateAndNormalizeStops({
      stopsInput: stops ?? schedule,
      allowedDestinationIds,
      tripDays: itinerary.days
    });
    if (!normalizedStopsResult.ok) {
      return res.status(400).json({ message: normalizedStopsResult.message });
    }
    if (normalizedStopsResult.provided) {
      itinerary.stops = normalizedStopsResult.stops;
      edit.stops = normalizedStopsResult.stops;
    }

    const { dayPlans } = await splitDestinationsByDays(itinerary.destinations, itinerary.days, req.user.id);
    itinerary.dayPlans = dayPlans;
    await itinerary.save();

    await logItineraryEvent(req, {
      severity: "Success",
      event: "Itinerary updated",
      description: "User updated itinerary.",
      status: "Success",
      metadata: { itineraryId: itinerary._id.toString() }
    });

    const actor = await User.findById(req.user.id).select("_id fullName");
    const participantIds = [itinerary.user, ...(itinerary.collaboratorIds || [])]
      .map((value) => value.toString())
      .filter((value) => value !== req.user.id.toString());

    if (participantIds.length) {
      await CollaborationNotification.insertMany(
        participantIds.map((participantId) => ({
          user: participantId,
          actor: req.user.id,
          type: "itinerary_updated",
          title: "Itinerary updated",
          message: `${actor?.fullName || "A collaborator"} updated a shared itinerary`,
          itineraryId: itinerary._id
        }))
      );
    }

    broadcastItineraryEdit({
      itineraryId: itinerary._id,
      actorId: req.user.id,
      actorName: actor?.fullName || null,
      edit,
      updatedAt: itinerary.updatedAt?.toISOString() || new Date().toISOString()
    });

    return res.json(withResolvedStops(itinerary));
  } catch (err) {
    console.error(err);
    await logItineraryEvent(req, {
      severity: "Error",
      event: "Itinerary update failed",
      description: err.message,
      status: "Failed",
      metadata: { itineraryId: req.params.id }
    });
    return res.status(500).json({ message: "Server error" });
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
      selectedDates,
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

    const selectedDatesResult = applySelectedDatesToItinerary({
      selectedDatesInput: selectedDates,
      currentDays: null,
      daysInputProvided: days !== undefined,
      normalizedDays
    });
    if (selectedDatesResult.error) {
      return res.status(400).json({ message: selectedDatesResult.error });
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
    const { dayPlans } = await splitDestinationsByDays(
      destinations,
      selectedDatesResult.days,
      userId
    );

    // 6) Save itinerary
    const itinerary = await Itinerary.create({
      user: userId,
      destinations,
      days: selectedDatesResult.days,
      selectedDates: selectedDatesResult.selectedDates,
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
