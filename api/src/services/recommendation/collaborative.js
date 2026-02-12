const Rating = require("../../models/Rating");
const Destination = require("../../models/Destination");

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keys) {
    const a = vecA[key] || 0;
    const b = vecB[key] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getCollaborativeRecommendations(userId) {
  const allRatings = await Rating.find({});
  if (!allRatings.length) return [];

  const userVectors = {};
  for (const rating of allRatings) {
    const uid = rating.user.toString();
    const did = rating.destination.toString();
    if (!userVectors[uid]) userVectors[uid] = {};
    userVectors[uid][did] = rating.rating;
  }

  const targetId = userId.toString();
  const targetVector = userVectors[targetId] || {};

  const weightedScores = {};
  for (const [otherUserId, otherVector] of Object.entries(userVectors)) {
    if (otherUserId === targetId) continue;

    const sim = cosineSimilarity(targetVector, otherVector);
    if (sim <= 0) continue;

    for (const [destinationId, score] of Object.entries(otherVector)) {
      if (targetVector[destinationId] != null) continue;
      weightedScores[destinationId] = (weightedScores[destinationId] || 0) + sim * score;
    }
  }

  const destinationIds = Object.keys(weightedScores);
  if (!destinationIds.length) return [];

  const destinations = await Destination.find({
    _id: { $in: destinationIds },
    isActive: true
  });
  const destinationMap = new Map(destinations.map((d) => [d._id.toString(), d]));

  return destinationIds
    .map((destinationId) => ({
      destination: destinationMap.get(destinationId),
      score: weightedScores[destinationId]
    }))
    .filter((item) => item.destination)
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  getCollaborativeRecommendations
};
