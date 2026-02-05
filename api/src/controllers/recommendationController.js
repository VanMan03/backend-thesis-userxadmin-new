const {
  getContentBasedRecommendations
} = require("../services/recommendation/contentBased");

/**
 * Get content-based recommendations for the logged-in user
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
