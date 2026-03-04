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

async function getGroupHybridRecommendations(
  participantIds,
  {
    weights = { cbf: 0.7, cf: 0.3 },
    travelStyle = "solo"
  } = {}
) {
  const normalizedParticipantIds = [...new Set((participantIds || []).map((id) => id.toString()))];
  if (!normalizedParticipantIds.length) return [];

  const combined = new Map();

  for (const userId of normalizedParticipantIds) {
    const userResults = await getHybridRecommendations(userId, weights);
    userResults.forEach(({ destination, score }) => {
      const destinationId = destination._id.toString();
      const entry = combined.get(destinationId) || {
        destination,
        totalScore: 0,
        participantCount: 0
      };
      entry.totalScore += score;
      entry.participantCount += 1;
      combined.set(destinationId, entry);
    });
  }

  const styleMultiplier = travelStyle === "family" || travelStyle === "family_group" ? 1.05 : 1;

  const averaged = [...combined.values()].map((entry) => ({
    destination: entry.destination,
    score: (entry.totalScore / entry.participantCount) * styleMultiplier
  }));

  averaged.sort((a, b) => b.score - a.score);
  return averaged;
}

module.exports = {
  getHybridRecommendations,
  getGroupHybridRecommendations
};
