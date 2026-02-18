const VALID_FEATURES = {
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
    "Water Taxi",
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

function normalizeFeatureObjectForCategory(category, selectedForCategory) {
  const valid = VALID_FEATURES[category] || [];
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

function normalizeFeatures(categoriesInput, selectedFeatures = {}) {
  const categories = normalizeCategories(categoriesInput);
  const features = {};

  if (!categories.length) return features;

  if (Array.isArray(selectedFeatures)) {
    const primaryCategory = categories[0];
    const normalized = normalizeFeatureObjectForCategory(primaryCategory, selectedFeatures);
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
      selectedFeatures[category]
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
    const normalized = normalizeFeatureObjectForCategory(primaryCategory, selectedFeatures);
    if (Object.keys(normalized).length) {
      features[primaryCategory] = normalized;
    }
  }

  return features;
}

module.exports = { normalizeFeatures, normalizeCategories };
