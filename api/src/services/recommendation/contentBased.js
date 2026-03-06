const Destination = require("../../models/Destination");
const User = require("../../models/User");
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
 * Calculate rank weight for interest matching
 * Rank 1 => weight 1.9x (highest priority)
 * Rank 5 => weight 1.5x 
 * Rank 9 => weight 1.1x (lowest priority)
 * No rank => weight 1.0x (default)
 */
function calculateRankWeight(rank) {
  if (!rank || rank < 1 || rank > 9) return 1.0;
  return 1 + (10 - rank) / 10;
}

/**
 * Map user boolean preferences to interest categories
 */
function mapPreferencesToInterests(preferences) {
  const interestMap = {
    natureTourism: 'Nature Tourism',
    culturalTourism: 'Cultural Tourism', 
    sunAndBeachTourism: 'Sun and Beach Tourism',
    cruiseAndNauticalTourism: 'Cruise and Nautical Tourism',
    leisureAndEntertainmentTourism: 'Leisure and Entertainment Tourism',
    divingAndMarineSportsTourism: 'Diving and Marine Sports Tourism',
    healthWelnessRetirementTourism: 'Health, Wellness, and Retirement Tourism',
    MICEAndEventsTourism: 'MICE and Events Tourism',
    educationTourism: 'Education Tourism'
  };

  const interests = [];
  for (const [prefKey, prefValue] of Object.entries(preferences)) {
    if (prefValue === true && interestMap[prefKey]) {
      interests.push(interestMap[prefKey]);
    }
  }
  return interests;
}

/**
 * Calculate content score with rank weighting
 */
function calculateContentScore(destinationFeatures, userInterests, interestRanks) {
  let interestScore = 0;
  let bestRankWeight = 1.0;

  userInterests.forEach(interest => {
    if (destinationFeatures[interest]) {
      const rank = interestRanks && interestRanks.get ? interestRanks.get(interest) : interestRanks?.[interest];
      const weight = calculateRankWeight(rank);
      
      // Apply weight to interest matching score
      interestScore += (Object.values(destinationFeatures[interest]).reduce((sum, val) => sum + (val || 0), 0)) * weight;
      
      // Track best rank for bonus scoring
      if (weight > bestRankWeight) {
        bestRankWeight = weight;
      }
    }
  });

  // Add small bonus for destinations matching highest ranked interests
  const rankBonus = (bestRankWeight - 1.0) * 10;
  
  return {
    baseScore: interestScore,
    rankBonus,
    totalScore: interestScore + rankBonus
  };
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
 * Get content-based recommendations with rank weighting
 */
async function getContentBasedRecommendations(userId) {
  const destinations = await Destination.find({ isActive: true });
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Get user interests from boolean preferences
  const userInterests = mapPreferencesToInterests(user.preferences || {});
  
  // Get interaction-based preference vector for collaborative scoring
  const userVector = await buildUserPreferenceVector(userId);

  const scoredDestinations = destinations.map((destination) => {
    const destinationFeatures = flattenFeatureVector(destination.features || {});
    
    // Calculate interaction-based similarity score
    const interactionScore = cosineSimilarity(userVector, destinationFeatures);
    
    // Calculate preference-based score with rank weighting
    const preferenceScore = calculateContentScore(
      destination.features || {}, 
      userInterests, 
      user.preferences?.interestRanks
    );
    
    // Combine scores: 70% interaction-based, 30% preference-based with ranking
    const combinedScore = (interactionScore * 0.7) + (preferenceScore.totalScore * 0.3);

    return {
      destination,
      score: combinedScore,
      interactionScore,
      preferenceScore: preferenceScore.totalScore,
      rankBonus: preferenceScore.rankBonus
    };
  });

  // If the user explicitly selected interests, suppress destinations that do not
  // match any selected interest category.
  const filteredDestinations = userInterests.length
    ? scoredDestinations.filter((item) =>
      userInterests.some((interest) => item.destination?.features?.[interest])
    )
    : scoredDestinations;

  // Sort by highest combined score
  filteredDestinations.sort((a, b) => b.score - a.score);

  return filteredDestinations;
}

module.exports = {
  getContentBasedRecommendations
};
