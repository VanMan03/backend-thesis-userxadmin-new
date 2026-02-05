//Handles itinerary creation and retrieval for users
const Itinerary = require("../models/Itinerary");

exports.createItinerary = async (req, res) => {
  try {
    const { destinations, totalCost, maxBudget } = req.body;

    const itinerary = await Itinerary.create({
      user: req.user.id,
      destinations,
      totalCost,
      maxBudget
    });

    res.status(201).json(itinerary);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ user: req.user.id })
      .populate("destinations.destination");

    res.json(itineraries);
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
    const { maxBudget } = req.body;

    if (!maxBudget) {
      return res.status(400).json({ message: "maxBudget is required" });
    }

    // 1️⃣ Get hybrid recommendations
    const hybridResults = await getHybridRecommendations(userId);

    if (!hybridResults.length) {
      return res.status(200).json({
        message: "No recommendations available",
        itinerary: []
      });
    }

    // 2️⃣ Apply knapsack optimization
    const optimized = knapsackOptimize(hybridResults, maxBudget);

    // 3️⃣ Compute total cost
    const totalCost = optimized.reduce(
      (sum, item) => sum + item.destination.estimatedCost,
      0
    );

    // 4️⃣ Prepare itinerary destinations
    const destinations = optimized.map((item) => ({
      destination: item.destination._id,
      cost: item.destination.estimatedCost,
      hybridScore: item.score
    }));

    // 5️⃣ Save itinerary
    const itinerary = await Itinerary.create({
      user: userId,
      destinations,
      totalCost,
      maxBudget,
      isSaved: true
    });

    res.status(201).json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
