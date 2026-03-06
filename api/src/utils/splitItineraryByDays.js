const User = require("../models/User");
const { normalizeMainInterestIds } = require("../shared/interests");

function normalizeDays(daysInput) {
  if (daysInput === undefined || daysInput === null || daysInput === "") {
    return null;
  }

  const parsed = Number(daysInput);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
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
  const canonicalMainInterests = normalizeMainInterestIds(preferences?.mainInterests);
  if (canonicalMainInterests.length) {
    const mappedLabels = {
      nature: "Nature Tourism",
      diving: "Diving and Marine Sports Tourism",
      sun_beach: "Sun and Beach Tourism",
      health_wellness: "Health, Wellness, and Retirement Tourism",
      events: "MICE and Events Tourism",
      culture_heritage: "Cultural Tourism",
      education: "Education Tourism",
      cruise: "Cruise and Nautical Tourism",
      leisure: "Leisure and Entertainment Tourism"
    };

    return canonicalMainInterests
      .map((id) => mappedLabels[id])
      .filter(Boolean);
  }

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
 * Calculate destination priority based on user ranks
 */
function calculateDestinationPriority(destination, userInterests, interestRanks) {
  let bestRankWeight = 1.0;
  let matchedInterests = 0;

  userInterests.forEach(interest => {
    if (destination.destination?.features && destination.destination.features[interest]) {
      matchedInterests++;
      const rank = interestRanks && interestRanks.get ? interestRanks.get(interest) : interestRanks?.[interest];
      const weight = calculateRankWeight(rank);
      
      if (weight > bestRankWeight) {
        bestRankWeight = weight;
      }
    }
  });

  // Higher priority for destinations with:
  // 1. Better rank weights (lower rank numbers)
  // 2. More matched interests
  return {
    priority: bestRankWeight * matchedInterests,
    bestRankWeight,
    matchedInterests
  };
}

/**
 * Enhanced split destinations by days with rank-based prioritization
 */
async function splitDestinationsByDays(destinations = [], daysInput, userId) {
  const normalizedDays = normalizeDays(daysInput);
  if (!normalizedDays) {
    return { days: null, dayPlans: [] };
  }

  // Get user data for rank-based scheduling
  let userInterests = [];
  let interestRanks = null;
  
  if (userId) {
    try {
      const user = await User.findById(userId);
      if (user && user.preferences) {
        userInterests = mapPreferencesToInterests(user.preferences);
        interestRanks = user.preferences.interestRanks;
      }
    } catch (error) {
      console.warn('Could not fetch user for rank-based scheduling:', error.message);
    }
  }

  // Calculate priority for each destination
  const destinationsWithPriority = destinations.map(dest => ({
    ...dest,
    priorityInfo: calculateDestinationPriority(dest, userInterests, interestRanks)
  }));

  // Sort by priority (higher priority first), then by original hybrid score
  destinationsWithPriority.sort((a, b) => {
    const priorityDiff = b.priorityInfo.priority - a.priorityInfo.priority;
    if (priorityDiff !== 0) return priorityDiff;
    
    // Fallback to hybrid score if priorities are equal
    return (b.hybridScore || 0) - (a.hybridScore || 0);
  });

  const total = destinationsWithPriority.length;
  const baseSize = Math.floor(total / normalizedDays);
  const remainder = total % normalizedDays;
  const dayPlans = [];
  let cursor = 0;

  for (let index = 0; index < normalizedDays; index += 1) {
    const take = baseSize + (index < remainder ? 1 : 0);
    const dayDestinations = destinationsWithPriority.slice(cursor, cursor + take);
    cursor += take;

    const dayCost = dayDestinations.reduce(
      (sum, item) => sum + (Number(item.cost) || 0),
      0
    );

    dayPlans.push({
      dayNumber: index + 1,
      destinations: dayDestinations,
      dayCost,
      priorityInfo: {
        highestPriority: dayDestinations[0]?.priorityInfo?.bestRankWeight || 1.0,
        averagePriority: dayDestinations.reduce((sum, item) => sum + (item.priorityInfo?.priority || 0), 0) / dayDestinations.length
      }
    });
  }

  return { days: normalizedDays, dayPlans };
}

module.exports = {
  normalizeDays,
  splitDestinationsByDays
};
