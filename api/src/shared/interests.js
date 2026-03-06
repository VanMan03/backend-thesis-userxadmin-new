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

function toSlug(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const mainAliasToId = new Map(
  MAIN_INTERESTS.flatMap((item) => ([
    [item.id.toLowerCase(), item.id],
    [`main-${toSlug(item.label)}`, item.id]
  ]))
);

const subAliasToId = new Map(
  SUB_INTERESTS.flatMap((item) => ([
    [item.id.toLowerCase(), item.id],
    [`sub-${toSlug(item.legacyCategory)}-${normalizeFeatureKey(item.legacyFeature)}`, item.id]
  ]))
);

function resolveMainInterestId(rawValue) {
  const value = rawValue?.toString().trim();
  if (!value) return null;
  if (MAIN_INTEREST_ID_SET.has(value)) return value;

  const lowered = value.toLowerCase();
  if (MAIN_INTEREST_ID_SET.has(lowered)) return lowered;
  if (lowered.startsWith("main-")) {
    const suffix = lowered.slice(5);
    if (MAIN_INTEREST_ID_SET.has(suffix)) return suffix;
  }
  return mainAliasToId.get(lowered) || null;
}

function resolveSubInterestId(rawValue) {
  const value = rawValue?.toString().trim();
  if (!value) return null;
  if (SUB_INTEREST_ID_SET.has(value)) return value;

  const lowered = value.toLowerCase();
  if (SUB_INTEREST_ID_SET.has(lowered)) return lowered;
  if (lowered.startsWith("sub-")) {
    const suffix = lowered.slice(4);
    if (SUB_INTEREST_ID_SET.has(suffix)) return suffix;
    const underscored = suffix.replace(/-/g, "_");
    if (SUB_INTEREST_ID_SET.has(underscored)) return underscored;
  }
  return subAliasToId.get(lowered) || null;
}

function normalizeResolvedIdList(input, resolver) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];

  return [...new Set(
    values
      .map((value) => resolver(value))
      .filter(Boolean)
  )];
}

function normalizeMainInterestIds(input) {
  return normalizeResolvedIdList(input, resolveMainInterestId);
}

function normalizeSubInterestIds(input) {
  return normalizeResolvedIdList(input, resolveSubInterestId);
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
