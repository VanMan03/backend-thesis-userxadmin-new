const schema = require("../../shared/interests.schema.json");

const MAIN_INTERESTS = schema.mainInterests;
const SUB_INTERESTS = schema.subInterests;

const MAIN_INTEREST_IDS = MAIN_INTERESTS.map((item) => item.id);
const SUB_INTEREST_IDS = SUB_INTERESTS.map((item) => item.id);

const MAIN_INTEREST_ID_SET = new Set(MAIN_INTEREST_IDS);
const SUB_INTEREST_ID_SET = new Set(SUB_INTEREST_IDS);

function normalizeCategoryKey(value = "") {
  return value.toString().trim().toLowerCase();
}

function normalizeFeatureKey(value = "") {
  return value
    .toString()
    .replace(/&/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toLowerCase();
}

function normalizeIdList(input, allowedSet) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];

  return [...new Set(
    values
      .map((value) => value?.toString().trim())
      .filter((value) => value && allowedSet.has(value))
  )];
}

function normalizeMainInterestIds(input) {
  return normalizeIdList(input, MAIN_INTEREST_ID_SET);
}

function normalizeSubInterestIds(input) {
  return normalizeIdList(input, SUB_INTEREST_ID_SET);
}

const mainLabelToId = new Map(
  MAIN_INTERESTS.map((item) => [normalizeCategoryKey(item.label), item.id])
);

const subById = new Map(SUB_INTERESTS.map((item) => [item.id, item]));

const subByLegacyCategoryFeature = new Map(
  SUB_INTERESTS.map((item) => [
    `${normalizeCategoryKey(item.legacyCategory)}::${normalizeFeatureKey(item.legacyFeature)}`,
    item.id
  ])
);

function canonicalToLegacySelection({ mainInterests, subInterests }) {
  const normalizedMainInterests = normalizeMainInterestIds(mainInterests);
  const normalizedSubInterests = normalizeSubInterestIds(subInterests);

  const categories = new Set();
  const features = {};

  MAIN_INTERESTS.forEach((item) => {
    if (normalizedMainInterests.includes(item.id)) {
      categories.add(item.label);
    }
  });

  normalizedSubInterests.forEach((subInterestId) => {
    const meta = subById.get(subInterestId);
    if (!meta) return;

    categories.add(meta.legacyCategory);

    if (!features[meta.legacyCategory]) {
      features[meta.legacyCategory] = [];
    }
    if (!features[meta.legacyCategory].includes(meta.legacyFeature)) {
      features[meta.legacyCategory].push(meta.legacyFeature);
    }
  });

  return {
    categories: [...categories],
    features
  };
}

function normalizeFeatureEntries(category, selectedForCategory) {
  if (Array.isArray(selectedForCategory)) {
    return selectedForCategory.map((item) => [item, true]);
  }

  if (!selectedForCategory || typeof selectedForCategory !== "object") {
    return [];
  }

  return Object.entries(selectedForCategory);
}

function legacyToCanonicalSelection({ categories, features }) {
  const mainInterests = new Set();
  const subInterests = new Set();
  const categoryList = Array.isArray(categories)
    ? categories
    : typeof categories === "string"
      ? [categories]
      : [];

  categoryList.forEach((category) => {
    const mainId = mainLabelToId.get(normalizeCategoryKey(category));
    if (mainId) mainInterests.add(mainId);
  });

  if (features && typeof features === "object") {
    Object.entries(features).forEach(([category, selectedForCategory]) => {
      const mainId = mainLabelToId.get(normalizeCategoryKey(category));
      if (mainId) mainInterests.add(mainId);

      normalizeFeatureEntries(category, selectedForCategory).forEach(([rawFeature, rawValue]) => {
        if (!rawValue) return;
        const subId = subByLegacyCategoryFeature.get(
          `${normalizeCategoryKey(category)}::${normalizeFeatureKey(rawFeature)}`
        );
        if (subId) subInterests.add(subId);
      });
    });
  }

  return {
    mainInterests: [...mainInterests],
    subInterests: [...subInterests]
  };
}

module.exports = {
  MAIN_INTERESTS,
  SUB_INTERESTS,
  MAIN_INTEREST_IDS,
  SUB_INTEREST_IDS,
  MAIN_INTEREST_ID_SET,
  SUB_INTEREST_ID_SET,
  normalizeMainInterestIds,
  normalizeSubInterestIds,
  canonicalToLegacySelection,
  legacyToCanonicalSelection
};
