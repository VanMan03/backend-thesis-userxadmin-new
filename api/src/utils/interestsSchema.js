const {
  getDefaultValidFeatures,
  sanitizeValidFeatures
} = require("./normalizeFeatures");

function toFeatureKey(value = "") {
  return value
    .replace(/&/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toLowerCase();
}

function toStableId(prefix, value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${normalized || "unknown"}`;
}

function toHumanLabelFromKey(key) {
  const raw = String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "";

  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildKnownFeatureKeyMap(destinationFeatureObjects = []) {
  const map = new Map();

  destinationFeatureObjects.forEach((featureGroup) => {
    if (!featureGroup || typeof featureGroup !== "object" || Array.isArray(featureGroup)) {
      return;
    }

    Object.entries(featureGroup).forEach(([rawCategory, rawFlags]) => {
      if (typeof rawCategory !== "string") return;
      const category = rawCategory.trim();
      if (!category || !rawFlags || typeof rawFlags !== "object" || Array.isArray(rawFlags)) {
        return;
      }

      if (!map.has(category)) {
        map.set(category, new Set());
      }

      Object.entries(rawFlags).forEach(([rawFeatureKey, enabled]) => {
        if (!enabled || typeof rawFeatureKey !== "string") return;
        const normalizedKey = toFeatureKey(rawFeatureKey.trim());
        if (!normalizedKey) return;
        map.get(category).add(normalizedKey);
      });
    });
  });

  return map;
}

function buildInterestsSchema({
  canonicalValidFeatures = getDefaultValidFeatures(),
  runtimeValidFeatures = {},
  destinationFeatureObjects = []
} = {}) {
  const canonical = sanitizeValidFeatures(canonicalValidFeatures);
  const runtime = sanitizeValidFeatures(runtimeValidFeatures);
  const knownKeysByCategory = buildKnownFeatureKeyMap(destinationFeatureObjects);

  const categorySet = new Set([
    ...Object.keys(canonical),
    ...Object.keys(runtime),
    ...knownKeysByCategory.keys()
  ]);

  const canonicalOrder = Object.keys(canonical);
  const extraCategories = [...categorySet]
    .filter((category) => !canonicalOrder.includes(category))
    .sort((a, b) => a.localeCompare(b));
  const orderedCategories = [...canonicalOrder, ...extraCategories];

  const seenMainIds = new Set();
  const mainInterests = [];

  orderedCategories.forEach((category) => {
    const categoryLabel = typeof category === "string" ? category.trim() : "";
    if (!categoryLabel) return;

    const mainId = toStableId("main", categoryLabel);
    if (!mainId || seenMainIds.has(mainId)) return;
    seenMainIds.add(mainId);

    const knownKeys = new Set();
    const keyToLabel = new Map();

    (canonical[categoryLabel] || []).forEach((featureLabel) => {
      const key = toFeatureKey(featureLabel);
      if (!key || knownKeys.has(key)) return;
      knownKeys.add(key);
      keyToLabel.set(key, featureLabel);
    });

    (runtime[categoryLabel] || []).forEach((featureLabel) => {
      const key = toFeatureKey(featureLabel);
      if (!key || knownKeys.has(key)) return;
      knownKeys.add(key);
      keyToLabel.set(key, featureLabel);
    });

    const discoveredKeys = [...(knownKeysByCategory.get(categoryLabel) || [])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    discoveredKeys.forEach((key) => {
      if (knownKeys.has(key)) return;
      knownKeys.add(key);
      keyToLabel.set(key, toHumanLabelFromKey(key));
    });

    const seenSubIds = new Set();
    const subInterests = [...knownKeys].map((featureKey) => {
      const label = (keyToLabel.get(featureKey) || "").trim() || toHumanLabelFromKey(featureKey);
      const id = toStableId("sub", `${categoryLabel}-${featureKey}`);
      if (!id || !label || seenSubIds.has(id)) return null;
      seenSubIds.add(id);
      return { id, label };
    }).filter(Boolean);

    mainInterests.push({
      id: mainId,
      label: categoryLabel,
      subInterests
    });
  });

  return { mainInterests };
}

module.exports = {
  buildInterestsSchema,
  toStableId
};
