// Handles itinerary creation and retrieval for users
const Itinerary = require("../models/Itinerary");
const mongoose = require("mongoose");
const {
  normalizeDays,
  splitDestinationsByDays
} = require("../utils/splitItineraryByDays");

exports.createItinerary = async (req, res) => {
  try {
    const { destinations, totalCost, maxBudget, budgetMode, isSaved, days } = req.body;
    const parsedBudget = Number(maxBudget);
    const normalizedDays = normalizeDays(days);
    const normalizedBudgetMode = ["constrained", "unconstrained"].includes(budgetMode)
      ? budgetMode
      : Number.isFinite(parsedBudget)
        ? "constrained"
        : "unconstrained";

    if (days !== undefined && normalizedDays === null) {
      return res.status(400).json({ message: "days must be a positive integer" });
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
      isSaved: Boolean(isSaved)
    });

    res.status(201).json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ user: req.user.id })
      .populate("destinations.destination")
      .populate("dayPlans.destinations.destination");

    res.json(itineraries);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUserItinerary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid itinerary ID" });
    }

    const deletedItinerary = await Itinerary.findOneAndDelete({
      _id: id,
      user: req.user.id
    });

    if (!deletedItinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    res.json({ message: "Itinerary deleted successfully" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

const {
  getHybridRecommendations
} = require("../services/recommendation/hybrid");
const {
  knapsackOptimize
} = require("../services/recommendation/knapsack");

/**
 * Generate itinerary using Hybrid Recommendation + Knapsack Optimization
 */
exports.generateItinerary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { maxBudget, days } = req.body;
    const normalizedDays = normalizeDays(days);

    if (!maxBudget) {
      return res.status(400).json({ message: "maxBudget is required" });
    }

    if (days !== undefined && normalizedDays === null) {
      return res.status(400).json({ message: "days must be a positive integer" });
    }

    // 1) Get hybrid recommendations
    const hybridResults = await getHybridRecommendations(userId);

    if (!hybridResults.length) {
      return res.status(200).json({
        message: "No recommendations available",
        itinerary: []
      });
    }

    // 2) Apply knapsack optimization
    const optimized = knapsackOptimize(hybridResults, maxBudget);

    // 3) Compute total cost
    const totalCost = optimized.reduce(
      (sum, item) => sum + item.destination.estimatedCost,
      0
    );

    // 4) Prepare itinerary destinations
    const destinations = optimized.map((item) => ({
      destination: item.destination._id,
      cost: item.destination.estimatedCost,
      hybridScore: item.score
    }));
    const { dayPlans } = splitDestinationsByDays(destinations, normalizedDays);

    // 5) Save itinerary
    const itinerary = await Itinerary.create({
      user: userId,
      destinations,
      days: normalizedDays,
      dayPlans,
      totalCost,
      maxBudget,
      isSaved: true,
      budgetMode: "constrained"
    });

    res.status(201).json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
