const {
  getContentBasedRecommendations
} = require("../services/recommendation/contentBased");

const {
  getHybridRecommendations
} = require("../services/recommendation/hybrid");

const {
  knapsackOptimize
} = require("../services/recommendation/knapsack");

const Itinerary = require("../models/Itinerary");

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
 * Generate itinerary using Hybrid ± Knapsack
 */
exports.generateItinerary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { budgetMode, maxBudget } = req.body;

    // 1. Always run hybrid recommendation
    const hybridResults = await getHybridRecommendations(userId);

    let finalResults = hybridResults;

    // 2. Conditionally apply knapsack
    if (budgetMode === "constrained") {
      if (!Number.isFinite(maxBudget)) {
        return res.status(400).json({
          message: "Budget is required for constrained mode"
        });
      }

      finalResults = knapsackOptimize(
        hybridResults,
        maxBudget
      );
    }

    // 3. Compute total cost
    const totalCost = finalResults.reduce(
      (sum, item) => sum + (item.destination.estimatedCost || 0),
      0
    );

    // 4. Save itinerary
    const itinerary = await Itinerary.create({
      user: userId,
      destinations: finalResults.map(item => ({
        destination: item.destination._id,
        cost: item.destination.estimatedCost || 0,
        hybridScore: item.score
      })),
      totalCost,
      maxBudget: budgetMode === "constrained" ? maxBudget : null,
      budgetMode
    });

    res.json({
      mode: budgetMode,
      totalCost,
      itinerary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
