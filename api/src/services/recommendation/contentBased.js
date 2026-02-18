const Destination = require("../../models/Destination");
const UserInteraction = require("../../models/UsersInteraction");

function flattenFeatureVector(features) {
  if (!features || typeof features !== "object") return {};

  const isNested = Object.values(features).some((value) =>
    value && typeof value === "object" && !Array.isArray(value)
  );

  if (!isNested) {
    return Object.fromEntries(
      Object.entries(features).filter(([, value]) => Number.isFinite(value))
    );
  }

  const flattened = {};

  Object.entries(features).forEach(([category, categoryFeatures]) => {
    if (!categoryFeatures || typeof categoryFeatures !== "object") return;

    Object.entries(categoryFeatures).forEach(([featureKey, value]) => {
      if (!Number.isFinite(value)) return;
      flattened[`${category}::${featureKey}`] = value;
    });
  });

  return flattened;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key in vecA) {
    const a = vecA[key] || 0;
    const b = vecB[key] || 0;

    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build user preference vector from interactions
 */
async function buildUserPreferenceVector(userId) {
  const interactions = await UserInteraction.find({ user: userId })
    .populate("destination");

  const preferenceVector = {};

  interactions.forEach((interaction) => {
    if (!interaction.destination || !interaction.destination.features) return;
    const destinationFeatures = flattenFeatureVector(interaction.destination.features);

    const weight =
      interaction.action === "view" ? 1 :
      interaction.action === "click" ? 2 :
      interaction.action === "save" ? 3 : 1;

    for (const feature in destinationFeatures) {
      preferenceVector[feature] =
        (preferenceVector[feature] || 0) +
        destinationFeatures[feature] * weight;
    }
  });

  return preferenceVector;
}

/**
 * Get content-based recommendations
 */
async function getContentBasedRecommendations(userId) {
  const destinations = await Destination.find({ isActive: true });
  const userVector = await buildUserPreferenceVector(userId);

  const scoredDestinations = destinations.map((destination) => {
    const destinationFeatures = flattenFeatureVector(destination.features || {});
    const score = cosineSimilarity(
      userVector,
      destinationFeatures
    );

    return {
      destination,
      score
    };
  });

  // Sort by highest similarity score
  scoredDestinations.sort((a, b) => b.score - a.score);

  return scoredDestinations;
}

module.exports = {
  getContentBasedRecommendations
};
