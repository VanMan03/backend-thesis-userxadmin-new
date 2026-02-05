const {
  getContentBasedRecommendations
} = require("./contentBased");

const {
  getCollaborativeRecommendations
} = require("./collaborative");

/**
 * Get hybrid recommendations (CBF + CF)
 */
async function getHybridRecommendations(userId, weights = { cbf: 0.7, cf: 0.3 }) {
  const cbfResults = await getContentBasedRecommendations(userId);
  const cfResults = await getCollaborativeRecommendations(userId);

  const hybridMap = {};

  // Add CBF scores
  cbfResults.forEach(({ destination, score }) => {
    hybridMap[destination._id.toString()] = {
      destination,
      score: score * weights.cbf
    };
  });

  // Add CF scores
  cfResults.forEach(({ destination, score }) => {
    const id = destination._id.toString();

    if (!hybridMap[id]) {
      hybridMap[id] = {
        destination,
        score: 0
      };
    }

    hybridMap[id].score += score * weights.cf;
  });

  // Convert map to sorted array
  const hybridResults = Object.values(hybridMap);
  hybridResults.sort((a, b) => b.score - a.score);

  return hybridResults;
}

module.exports = {
  getHybridRecommendations
};
