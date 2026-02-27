const DEFAULT_VALID_FEATURES = {
  "Nature Tourism": [
    "Eco-Tours",
    "Wilderness Trekking",
    "Volcanic Sites",
    "Caves & Canyons"
  ],

  "Cultural Tourism": [
    "Heritage Tours",
    "Food Tourism",
    "Festival & Events",
    "Arts & Crafts"
  ],

  "Sun and Beach Tourism": [
    "Island Hopping",
    "Beach & Resorts",
    "Surfing & Skimboarding",
    "Coastal Relaxation"
  ],

  "Cruise and Nautical Tourism": [
    "Luxury Cruises",
    "Yachting & Sailing",
    "Ferry Travel",
    "Water Taxi"
  ],

  "Leisure and Entertainment Tourism": [
    "Theme Parks",
    "Nightlife & Bars",
    "Shopping & Retail",
    "Casinos"
  ],

  "Diving and Marine Sports Tourism": [
    "Scuba Diving",
    "Snorkeling",
    "Wreck Diving",
    "Freediving"
  ],

  "Health, Wellness, and Retirement Tourism": [
    "Spa & Retreats",
    "Medical Tourism",
    "Retirement Villages",
    "Beauty & Anti-Aging"
  ],

  "MICE and Events Tourism": [
    "Conventions",
    "Corporate Meetings",
    "Incentive & Team Building",
    "Exhibition"
  ],

  "Education Tourism": [
    "Study Tours",
    "Historical Site Learning",
    "Culinary School",
    "Language Immersion"
  ]
};

function toFeatureKey(value = "") {
  return value
    .replace(/&/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toLowerCase();
}

function normalizeCategories(categoryInput) {
  const list = Array.isArray(categoryInput)
    ? categoryInput
    : typeof categoryInput === "string"
      ? [categoryInput]
      : [];

  return [...new Set(
    list
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function normalizeFeatureList(featureInput) {
  const list = Array.isArray(featureInput)
    ? featureInput
    : typeof featureInput === "string"
      ? [featureInput]
      : [];

  return [...new Set(
    list
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function sanitizeValidFeatures(validFeaturesInput) {
  if (!validFeaturesInput || typeof validFeaturesInput !== "object") {
    return {};
  }

  const sanitized = {};

  Object.entries(validFeaturesInput).forEach(([rawCategory, rawFeatures]) => {
    if (typeof rawCategory !== "string") return;
    const category = rawCategory.trim();
    if (!category) return;

    const features = normalizeFeatureList(rawFeatures);
    if (!features.length) return;

    sanitized[category] = features;
  });

  return sanitized;
}

function getDefaultValidFeatures() {
  return sanitizeValidFeatures(DEFAULT_VALID_FEATURES);
}

function normalizeFeatureObjectForCategory(category, selectedForCategory, validFeaturesByCategory) {
  const valid = validFeaturesByCategory[category] || [];
  const validKeys = new Set(valid.map((item) => toFeatureKey(item)));
  const result = {};

  if (Array.isArray(selectedForCategory)) {
    selectedForCategory.forEach((item) => {
      if (valid.includes(item)) {
        result[toFeatureKey(item)] = 1;
      }
    });
    return result;
  }

  if (!selectedForCategory || typeof selectedForCategory !== "object") {
    return result;
  }

  Object.entries(selectedForCategory).forEach(([rawKey, rawValue]) => {
    if (!rawValue) return;
    const normalizedKey = valid.includes(rawKey) ? toFeatureKey(rawKey) : rawKey;
    if (validKeys.has(normalizedKey)) {
      result[normalizedKey] = 1;
    }
  });

  return result;
}

function normalizeFeatures(categoriesInput, selectedFeatures = {}, validFeaturesInput = DEFAULT_VALID_FEATURES) {
  const categories = normalizeCategories(categoriesInput);
  const validFeaturesByCategory = sanitizeValidFeatures(validFeaturesInput);
  const features = {};

  if (!categories.length) return features;

  if (Array.isArray(selectedFeatures)) {
    const primaryCategory = categories[0];
    const normalized = normalizeFeatureObjectForCategory(
      primaryCategory,
      selectedFeatures,
      validFeaturesByCategory
    );
    if (Object.keys(normalized).length) {
      features[primaryCategory] = normalized;
    }
    return features;
  }

  if (!selectedFeatures || typeof selectedFeatures !== "object") {
    return features;
  }

  categories.forEach((category) => {
    const normalized = normalizeFeatureObjectForCategory(
      category,
      selectedFeatures[category],
      validFeaturesByCategory
    );
    if (Object.keys(normalized).length) {
      features[category] = normalized;
    }
  });

  const hasPerCategoryInput = categories.some((category) =>
    Object.prototype.hasOwnProperty.call(selectedFeatures, category)
  );

  if (!hasPerCategoryInput) {
    const primaryCategory = categories[0];
    const normalized = normalizeFeatureObjectForCategory(
      primaryCategory,
      selectedFeatures,
      validFeaturesByCategory
    );
    if (Object.keys(normalized).length) {
      features[primaryCategory] = normalized;
    }
  }

  return features;
}

module.exports = {
  DEFAULT_VALID_FEATURES,
  normalizeFeatures,
  normalizeCategories,
  normalizeFeatureList,
  sanitizeValidFeatures,
  getDefaultValidFeatures
};
