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

function mapFlatFeaturesToCategories(categories, selectedFeatures, validFeaturesByCategory) {
  const features = {};
  if (!categories.length) return features;

  const rawList = Array.isArray(selectedFeatures)
    ? selectedFeatures
    : Object.entries(selectedFeatures || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);

  const list = rawList
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!list.length) return features;

  const categoryMeta = categories.map((category) => {
    const valid = validFeaturesByCategory[category] || [];
    return {
      category,
      validSet: new Set(valid),
      keyToLabel: new Map(valid.map((label) => [toFeatureKey(label), label]))
    };
  });

  const selections = Object.fromEntries(categories.map((category) => [category, []]));

  list.forEach((rawFeature) => {
    const normalizedKey = toFeatureKey(rawFeature);
    for (const meta of categoryMeta) {
      if (meta.validSet.has(rawFeature)) {
        selections[meta.category].push(rawFeature);
        return;
      }
      const label = meta.keyToLabel.get(normalizedKey);
      if (label) {
        selections[meta.category].push(label);
        return;
      }
    }
  });

  Object.entries(selections).forEach(([category, selectedForCategory]) => {
    const normalized = normalizeFeatureObjectForCategory(
      category,
      selectedForCategory,
      validFeaturesByCategory
    );
    if (Object.keys(normalized).length) {
      features[category] = normalized;
    }
  });

  return features;
}

function normalizeFeatures(categoriesInput, selectedFeatures = {}, validFeaturesInput = DEFAULT_VALID_FEATURES) {
  const categories = normalizeCategories(categoriesInput);
  const validFeaturesByCategory = sanitizeValidFeatures(validFeaturesInput);
  const features = {};

  if (!categories.length) return features;

  if (Array.isArray(selectedFeatures)) {
    return mapFlatFeaturesToCategories(categories, selectedFeatures, validFeaturesByCategory);
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
    return mapFlatFeaturesToCategories(categories, selectedFeatures, validFeaturesByCategory);
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
