// This controller manages admin operations for destinations
const Destination = require("../models/Destination");
const DestinationTaxonomy = require("../models/DestinationTaxonomy");
const User = require("../models/User");
const Itinerary = require("../models/Itinerary");
const SystemLog = require("../models/SystemLog");
const Rating = require("../models/Rating");
const RecommendationFeedback = require("../models/RecommendationFeedback");
const DestinationComment = require("../models/DestinationComment");
const mongoose = require("mongoose");
const {
  normalizeFeatures,
  normalizeCategories,
  normalizeFeatureList,
  sanitizeValidFeatures,
  getDefaultValidFeatures
} = require("../utils/normalizeFeatures");
const {
  normalizeMainInterestIds,
  normalizeSubInterestIds,
  canonicalToLegacySelection,
  legacyToCanonicalSelection
} = require("../shared/interests");
const {
  createSystemLog,
  allowedSeverities
} = require("../services/systemLogService");
const cloudinary = require("../config/cloudinary");
const {
  getRouteSummary,
  reverseGeocode
} = require("../services/mapboxService");
const { parseDurationHoursFromPayload } = require("../utils/durationHours");

const TAXONOMY_KEY = "default";
const allowedLogStatuses = new Set(["Success", "Warning", "Failed"]);

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function resolveCoordinateInput(payload = {}) {
  const location = payload?.location && typeof payload.location === "object"
    ? payload.location
    : {};

  const latProvided =
    hasOwn(payload, "latitude") ||
    hasOwn(payload, "lat") ||
    hasOwn(location, "latitude") ||
    hasOwn(location, "lat");
  const lngProvided =
    hasOwn(payload, "longitude") ||
    hasOwn(payload, "lng") ||
    hasOwn(location, "longitude") ||
    hasOwn(location, "lng");

  const rawLatitude = hasOwn(payload, "latitude")
    ? payload.latitude
    : hasOwn(payload, "lat")
      ? payload.lat
      : hasOwn(location, "latitude")
        ? location.latitude
        : location.lat;

  const rawLongitude = hasOwn(payload, "longitude")
    ? payload.longitude
    : hasOwn(payload, "lng")
      ? payload.lng
      : hasOwn(location, "longitude")
        ? location.longitude
        : location.lng;

  return {
    hasAny: latProvided || lngProvided,
    latitude: parseCoordinate(rawLatitude),
    longitude: parseCoordinate(rawLongitude)
  };
}

function normalizeOptionalString(value, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    const err = new Error(`${label} must be a string`);
    err.status = 400;
    throw err;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function extractAddressInput(payload = {}) {
  const sourceAddress = payload.address && typeof payload.address === "object"
    ? payload.address
    : {};
  const fields = ["purok", "barangay", "municipality", "province", "fullAddress"];
  const hasAddressObject = hasOwn(payload, "address");
  const hasFlatFields = fields.some((field) => hasOwn(payload, field)) ||
    hasOwn(payload, "city") ||
    hasOwn(sourceAddress, "city");
  const hasAny = hasAddressObject || hasFlatFields;

  if (!hasAny) {
    return { hasAny: false, value: undefined };
  }

  if (hasAddressObject && payload.address !== null && typeof payload.address !== "object") {
    const err = new Error("address must be an object");
    err.status = 400;
    throw err;
  }

  if (payload.address === null) {
    return { hasAny: true, value: null };
  }

  const normalized = {};
  for (const field of fields) {
    let rawValue;
    if (field === "municipality") {
      rawValue = hasOwn(sourceAddress, "municipality")
        ? sourceAddress.municipality
        : hasOwn(payload, "municipality")
          ? payload.municipality
          : hasOwn(sourceAddress, "city")
            ? sourceAddress.city
            : payload.city;
    } else {
      rawValue = hasOwn(sourceAddress, field) ? sourceAddress[field] : payload[field];
    }
    const normalizedValue = normalizeOptionalString(rawValue, `address.${field}`);
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue;
    }
  }

  return {
    hasAny: true,
    value: Object.keys(normalized).length ? normalized : {}
  };
}

function parseTaxonomyKey(value) {
  if (typeof value !== "string") return "";
  return decodeURIComponent(value).trim();
}

function filterSupportedCategories(categories, validFeaturesMap) {
  const allowed = new Set(Object.keys(validFeaturesMap));
  return categories.filter((item) => allowed.has(item));
}

function parseDateInput(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseOptionalObjectId(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (!mongoose.Types.ObjectId.isValid(trimmed)) return undefined;
  return trimmed;
}

async function logAdminAction(req, payload) {
  await createSystemLog({
    ...payload,
    actorId: req.user?.id || null,
    actorRole: req.user?.role || "admin",
    metadata: {
      path: req.originalUrl,
      method: req.method,
      ...(payload.metadata || {})
    }
  });
}

async function getOrCreateTaxonomyDoc() {
  let taxonomy = await DestinationTaxonomy.findOne({ key: TAXONOMY_KEY });

  if (!taxonomy) {
    taxonomy = await DestinationTaxonomy.create({
      key: TAXONOMY_KEY,
      validFeatures: getDefaultValidFeatures()
    });
  }

  return taxonomy;
}

async function getValidFeaturesMap() {
  const taxonomy = await getOrCreateTaxonomyDoc();
  const current = sanitizeValidFeatures(taxonomy.validFeatures || {});

  if (!Object.keys(current).length) {
    const fallback = getDefaultValidFeatures();
    taxonomy.validFeatures = fallback;
    await taxonomy.save();
    return fallback;
  }

  return current;
}

function normalizeDestinationInterests({
  sourceCategories,
  sourceFeatures,
  sourceMainInterests,
  sourceSubInterests,
  validFeaturesMap
}) {
  const normalizedMainInterests = normalizeMainInterestIds(sourceMainInterests);
  const normalizedSubInterests = normalizeSubInterestIds(sourceSubInterests);

  if (
    Array.isArray(sourceMainInterests) &&
    normalizedMainInterests.length !== sourceMainInterests.length
  ) {
    const err = new Error("mainInterests contains invalid IDs");
    err.status = 400;
    throw err;
  }

  if (
    Array.isArray(sourceSubInterests) &&
    normalizedSubInterests.length !== sourceSubInterests.length
  ) {
    const err = new Error("subInterests contains invalid IDs");
    err.status = 400;
    throw err;
  }

  const hasCanonicalInput = normalizedMainInterests.length > 0 || normalizedSubInterests.length > 0;

  const legacyFromCanonical = hasCanonicalInput
    ? canonicalToLegacySelection({
      mainInterests: normalizedMainInterests,
      subInterests: normalizedSubInterests
    })
    : { categories: [], features: {} };

  const normalizedCategories = filterSupportedCategories(
    normalizeCategories(
      legacyFromCanonical.categories.length ? legacyFromCanonical.categories : sourceCategories
    ),
    validFeaturesMap
  );

  const normalizedFeatures = normalizeFeatures(
    normalizedCategories,
    Object.keys(legacyFromCanonical.features).length ? legacyFromCanonical.features : sourceFeatures,
    validFeaturesMap
  );

  const inferredCanonical = legacyToCanonicalSelection({
    categories: normalizedCategories,
    features: normalizedFeatures
  });

  return {
    categories: normalizedCategories,
    features: normalizedFeatures,
    mainInterests: normalizedMainInterests.length
      ? normalizedMainInterests
      : inferredCanonical.mainInterests,
    subInterests: normalizedSubInterests.length
      ? normalizedSubInterests
      : inferredCanonical.subInterests
  };
}

function toIdArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => value?.toString().trim())
    .filter(Boolean);
}

function sameStringArray(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

exports.getDestinationTaxonomy = async (_req, res) => {
  try {
    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});

    res.json({
      key: taxonomy.key,
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Get destination taxonomy error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.replaceDestinationTaxonomy = async (req, res) => {
  try {
    const payload = Object.prototype.hasOwnProperty.call(req.body || {}, "validFeatures")
      ? req.body.validFeatures
      : req.body;

    const sanitized = sanitizeValidFeatures(payload);
    if (!Object.keys(sanitized).length) {
      return res.status(400).json({
        message: "validFeatures must include at least one category with at least one feature"
      });
    }

    const taxonomy = await DestinationTaxonomy.findOneAndUpdate(
      { key: TAXONOMY_KEY },
      {
        key: TAXONOMY_KEY,
        validFeatures: sanitized
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      key: taxonomy.key,
      validFeatures: sanitizeValidFeatures(taxonomy.validFeatures),
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Replace destination taxonomy error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createDestinationCategory = async (req, res) => {
  try {
    const category = parseTaxonomyKey(req.body.category);
    const features = normalizeFeatureList(req.body.features);

    if (!category) {
      return res.status(400).json({ message: "category is required" });
    }

    if (!features.length) {
      return res.status(400).json({ message: "At least one feature is required" });
    }

    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});

    if (validFeatures[category]) {
      return res.status(409).json({ message: "Category already exists" });
    }

    validFeatures[category] = features;
    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.status(201).json({
      category,
      features,
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Create destination category error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateDestinationCategory = async (req, res) => {
  try {
    const currentCategory = parseTaxonomyKey(req.params.category);
    const newCategory = Object.prototype.hasOwnProperty.call(req.body || {}, "category")
      ? parseTaxonomyKey(req.body.category)
      : currentCategory;

    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});

    if (!validFeatures[currentCategory]) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!newCategory) {
      return res.status(400).json({ message: "category is required" });
    }

    if (newCategory !== currentCategory && validFeatures[newCategory]) {
      return res.status(409).json({ message: "Target category already exists" });
    }

    const nextFeatures = Object.prototype.hasOwnProperty.call(req.body || {}, "features")
      ? normalizeFeatureList(req.body.features)
      : validFeatures[currentCategory];

    if (!nextFeatures.length) {
      return res.status(400).json({ message: "At least one feature is required" });
    }

    delete validFeatures[currentCategory];
    validFeatures[newCategory] = nextFeatures;

    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.json({
      category: newCategory,
      features: nextFeatures,
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Update destination category error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteDestinationCategory = async (req, res) => {
  try {
    const category = parseTaxonomyKey(req.params.category);
    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});

    if (!validFeatures[category]) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (Object.keys(validFeatures).length <= 1) {
      return res.status(400).json({ message: "At least one category must remain" });
    }

    delete validFeatures[category];
    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.json({ validFeatures, updatedAt: taxonomy.updatedAt });
  } catch (err) {
    console.error("Delete destination category error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createDestinationFeature = async (req, res) => {
  try {
    const category = parseTaxonomyKey(req.params.category);
    const feature = parseTaxonomyKey(req.body.feature);

    if (!feature) {
      return res.status(400).json({ message: "feature is required" });
    }

    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});

    if (!validFeatures[category]) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (validFeatures[category].includes(feature)) {
      return res.status(409).json({ message: "Feature already exists in category" });
    }

    validFeatures[category] = [...validFeatures[category], feature];
    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.status(201).json({
      category,
      feature,
      features: validFeatures[category],
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Create destination feature error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateDestinationFeature = async (req, res) => {
  try {
    const category = parseTaxonomyKey(req.params.category);
    const currentFeature = parseTaxonomyKey(req.params.feature);
    const newFeature = parseTaxonomyKey(req.body.feature);

    if (!newFeature) {
      return res.status(400).json({ message: "feature is required" });
    }

    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});
    const featureList = validFeatures[category];

    if (!featureList) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!featureList.includes(currentFeature)) {
      return res.status(404).json({ message: "Feature not found" });
    }

    if (currentFeature !== newFeature && featureList.includes(newFeature)) {
      return res.status(409).json({ message: "Target feature already exists" });
    }

    validFeatures[category] = featureList.map((item) =>
      item === currentFeature ? newFeature : item
    );

    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.json({
      category,
      feature: newFeature,
      features: validFeatures[category],
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Update destination feature error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteDestinationFeature = async (req, res) => {
  try {
    const category = parseTaxonomyKey(req.params.category);
    const feature = parseTaxonomyKey(req.params.feature);

    const taxonomy = await getOrCreateTaxonomyDoc();
    const validFeatures = sanitizeValidFeatures(taxonomy.validFeatures || {});
    const featureList = validFeatures[category];

    if (!featureList) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!featureList.includes(feature)) {
      return res.status(404).json({ message: "Feature not found" });
    }

    if (featureList.length <= 1) {
      return res.status(400).json({ message: "At least one feature must remain in a category" });
    }

    validFeatures[category] = featureList.filter((item) => item !== feature);

    taxonomy.validFeatures = validFeatures;
    await taxonomy.save();

    res.json({
      category,
      features: validFeatures[category],
      validFeatures,
      updatedAt: taxonomy.updatedAt
    });
  } catch (err) {
    console.error("Delete destination feature error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createDestination = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      categories,
      features,
      mainInterests,
      subInterests,
      estimatedCost
    } = req.body;
    const durationInput = parseDurationHoursFromPayload(req.body);

    const coordinateInput = resolveCoordinateInput(req.body);
    const parsedLatitude = coordinateInput.latitude;
    const parsedLongitude = coordinateInput.longitude;

    if (parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        message: "location coordinates are required numbers (latitude/longitude or lat/lng)"
      });
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      return res.status(400).json({ message: "latitude must be between -90 and 90" });
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ message: "longitude must be between -180 and 180" });
    }

    const validFeaturesMap = await getValidFeaturesMap();
    const normalizedInterestData = normalizeDestinationInterests({
      sourceCategories: categories ?? category,
      sourceFeatures: features,
      sourceMainInterests: mainInterests,
      sourceSubInterests: subInterests,
      validFeaturesMap
    });
    const normalizedCategories = normalizedInterestData.categories;

    if (!normalizedCategories.length) {
      return res.status(400).json({
        message: "At least one valid category is required"
      });
    }

    const normalizedFeatures = normalizedInterestData.features;

    if (!Object.keys(normalizedFeatures).length) {
      return res.status(400).json({
        message: "At least one valid feature is required"
      });
    }

    let resolvedAddress = null;

    if (process.env.MAPBOX_SERVER_TOKEN) {
      try {
        resolvedAddress = await reverseGeocode(parsedLongitude, parsedLatitude);
      } catch (mapboxErr) {
        console.warn("Create destination: Mapbox address resolution failed", {
          longitude: parsedLongitude,
          latitude: parsedLatitude,
          details: mapboxErr.message
        });
      }
    }

    const uploadedImages = Array.isArray(req.body.images)
      ? req.body.images
      : [];
    const addressInput = extractAddressInput(req.body);

    const destination = await Destination.create({
      name,
      description,
      category: normalizedCategories,
      features: normalizedFeatures,
      mainInterests: normalizedInterestData.mainInterests,
      subInterests: normalizedInterestData.subInterests,
      estimatedCost,
      durationHours: durationInput.value,
      location: {
        lat: parsedLatitude,
        lng: parsedLongitude,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      },
      address: addressInput.value,
      images: uploadedImages,
      isActive: true
    });

    await logAdminAction(req, {
      severity: "Success",
      event: "Destination created",
      description: `Destination '${destination.name}' was created.`,
      status: "Success",
      metadata: { destinationId: destination._id.toString() }
    });

    res.status(201).json(destination);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    if (err?.name === "ValidationError") {
      const firstMessage = Object.values(err.errors || {})[0]?.message || "Validation failed";
      return res.status(400).json({ message: firstMessage });
    }
    console.error("Create destination error:", err);
    await logAdminAction(req, {
      severity: "Error",
      event: "Destination create failed",
      description: err.message,
      status: "Failed",
      metadata: { body: req.body }
    });
    res.status(500).json({ message: "Server error" });
  }
};

// EDIT
exports.updateDestination = async (req, res) => {
  try {
    const updates = { ...req.body };
    const addressInput = extractAddressInput(updates);
    const durationInput = parseDurationHoursFromPayload(updates);

    if (durationInput.hasAnyDurationInput) {
      updates.durationHours = durationInput.value;
      delete updates.estimatedDuration;
      delete updates.duration;
    }

    const coordinateInput = resolveCoordinateInput(updates);

    if (coordinateInput.hasAny) {
      const parsedLatitude = coordinateInput.latitude;
      const parsedLongitude = coordinateInput.longitude;

      if (parsedLatitude === null || parsedLongitude === null) {
        return res.status(400).json({
          message: "location coordinates are required together as numbers (latitude/longitude or lat/lng)"
        });
      }

      if (parsedLatitude < -90 || parsedLatitude > 90) {
        return res.status(400).json({ message: "latitude must be between -90 and 90" });
      }

      if (parsedLongitude < -180 || parsedLongitude > 180) {
        return res.status(400).json({ message: "longitude must be between -180 and 180" });
      }

      let resolvedAddress = null;
      if (process.env.MAPBOX_SERVER_TOKEN) {
        try {
          resolvedAddress = await reverseGeocode(parsedLongitude, parsedLatitude);
        } catch (mapboxErr) {
          console.warn("Update destination: Mapbox address resolution failed", {
            destinationId: req.params.id,
            longitude: parsedLongitude,
            latitude: parsedLatitude,
            details: mapboxErr.message
          });
        }
      }

      delete updates.latitude;
      delete updates.longitude;
      delete updates.lat;
      delete updates.lng;
      delete updates.location;
      updates.location = {
        lat: parsedLatitude,
        lng: parsedLongitude,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      };
    }

    if (addressInput.hasAny) {
      updates.address = addressInput.value;
      delete updates.purok;
      delete updates.barangay;
      delete updates.city;
      delete updates.municipality;
      delete updates.province;
      delete updates.fullAddress;
    }

    const hasCategoryUpdate =
      Object.prototype.hasOwnProperty.call(updates, "category") ||
      Object.prototype.hasOwnProperty.call(updates, "categories");
    const hasFeaturesUpdate = Object.prototype.hasOwnProperty.call(updates, "features");
    const hasMainInterestsUpdate = Object.prototype.hasOwnProperty.call(updates, "mainInterests");
    const hasSubInterestsUpdate = Object.prototype.hasOwnProperty.call(updates, "subInterests");

    if (hasCategoryUpdate || hasFeaturesUpdate || hasMainInterestsUpdate || hasSubInterestsUpdate) {
      const existingDestination = await Destination.findById(req.params.id);
      if (!existingDestination) {
        return res.status(404).json({ message: "Destination not found" });
      }

      const validFeaturesMap = await getValidFeaturesMap();
      const sourceCategories = hasCategoryUpdate
        ? updates.categories ?? updates.category
        : existingDestination.category;
      const sourceFeatures = hasFeaturesUpdate
        ? updates.features
        : existingDestination.features;
      const sourceMainInterests = hasMainInterestsUpdate
        ? updates.mainInterests
        : existingDestination.mainInterests;
      const sourceSubInterests = hasSubInterestsUpdate
        ? updates.subInterests
        : existingDestination.subInterests;

      const normalizedInterestData = normalizeDestinationInterests({
        sourceCategories,
        sourceFeatures,
        sourceMainInterests,
        sourceSubInterests,
        validFeaturesMap
      });

      if (!normalizedInterestData.categories.length) {
        return res.status(400).json({
          message: "At least one valid category is required"
        });
      }

      if (!Object.keys(normalizedInterestData.features).length) {
        return res.status(400).json({
          message: "At least one valid feature is required"
        });
      }

      updates.category = normalizedInterestData.categories;
      updates.features = normalizedInterestData.features;
      updates.mainInterests = normalizedInterestData.mainInterests;
      updates.subInterests = normalizedInterestData.subInterests;
      delete updates.categories;
    }

    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    await logAdminAction(req, {
      severity: "Info",
      event: "Destination updated",
      description: `Destination '${destination.name}' was updated.`,
      status: "Success",
      metadata: { destinationId: destination._id.toString() }
    });

    res.json(destination);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    if (err?.name === "ValidationError") {
      const firstMessage = Object.values(err.errors || {})[0]?.message || "Validation failed";
      return res.status(400).json({ message: firstMessage });
    }
    console.error(err);
    await logAdminAction(req, {
      severity: "Error",
      event: "Destination update failed",
      description: err.message,
      status: "Failed",
      metadata: { destinationId: req.params.id }
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.backfillDestinationInterests = async (req, res) => {
  try {
    const includeInactive = req.body?.includeInactive === true;
    const dryRun = req.body?.dryRun !== false;
    const query = includeInactive ? {} : { isActive: true };

    const destinations = await Destination.find(query).select(
      "_id name category features mainInterests subInterests isActive"
    );

    const bulkOps = [];
    const changed = [];

    destinations.forEach((destination) => {
      const inferred = legacyToCanonicalSelection({
        categories: destination.category,
        features: destination.features
      });

      const normalizedMain = normalizeMainInterestIds(destination.mainInterests);
      const normalizedSub = normalizeSubInterestIds(destination.subInterests);

      const canonicalMain = normalizedMain.length
        ? normalizedMain
        : inferred.mainInterests;
      const canonicalSub = normalizedSub.length
        ? normalizedSub
        : inferred.subInterests;

      const storedMain = toIdArray(destination.mainInterests);
      const storedSub = toIdArray(destination.subInterests);

      const mainChanged = !sameStringArray(storedMain, canonicalMain);
      const subChanged = !sameStringArray(storedSub, canonicalSub);
      if (!mainChanged && !subChanged) return;

      changed.push({
        destinationId: destination._id.toString(),
        name: destination.name || null,
        isActive: destination.isActive !== false,
        before: {
          mainInterests: storedMain,
          subInterests: storedSub
        },
        after: {
          mainInterests: canonicalMain,
          subInterests: canonicalSub
        }
      });

      bulkOps.push({
        updateOne: {
          filter: { _id: destination._id },
          update: {
            $set: {
              mainInterests: canonicalMain,
              subInterests: canonicalSub
            }
          }
        }
      });
    });

    if (!dryRun && bulkOps.length) {
      await Destination.bulkWrite(bulkOps, { ordered: false });
    }

    return res.status(200).json({
      dryRun,
      includeInactive,
      scannedCount: destinations.length,
      updateCount: changed.length,
      updatedIds: changed.map((item) => item.destinationId),
      sample: changed.slice(0, 20)
    });
  } catch (err) {
    console.error("Backfill destination interests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// SOFT DELETE (DEACTIVATE) destination
exports.deleteDestination = async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    destination.isActive = false;
    await destination.save();

    await logAdminAction(req, {
      severity: "Warning",
      event: "Destination deactivated",
      description: `Destination '${destination.name}' was deactivated.`,
      status: "Warning",
      metadata: { destinationId: destination._id.toString() }
    });

    res.json({ message: "Destination deactivated successfully" });
  } catch (err) {
    console.error(err);
    await logAdminAction(req, {
      severity: "Error",
      event: "Destination deactivation failed",
      description: err.message,
      status: "Failed",
      metadata: { destinationId: req.params.id }
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllDestinationsAdmin = async (req, res) => {
  try {
    const destinations = await Destination.find();
    await logAdminAction(req, {
      severity: "Info",
      event: "Destinations listed",
      description: `Admin retrieved ${destinations.length} destinations.`,
      status: "Success"
    });
    res.json(destinations);
  } catch (err) {
    await logAdminAction(req, {
      severity: "Error",
      event: "Destination list fetch failed",
      description: err.message,
      status: "Failed"
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    await logAdminAction(req, {
      severity: "Info",
      event: "Users listed",
      description: `Admin retrieved ${users.length} users.`,
      status: "Success"
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    await logAdminAction(req, {
      severity: "Error",
      event: "User list fetch failed",
      description: err.message,
      status: "Failed"
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find()
      .populate("user", "name email")
      .populate("destinations.destination", "name");

    await logAdminAction(req, {
      severity: "Info",
      event: "Itineraries listed",
      description: `Admin retrieved ${itineraries.length} itineraries.`,
      status: "Success"
    });

    res.json(itineraries);
  } catch (err) {
    console.error(err);
    await logAdminAction(req, {
      severity: "Error",
      event: "Itinerary list fetch failed",
      description: err.message,
      status: "Failed"
    });
    res.status(500).json({ message: "Server error" });
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    const severity = typeof req.query.severity === "string"
      ? req.query.severity.trim()
      : "";
    const status = typeof req.query.status === "string"
      ? req.query.status.trim()
      : "";
    const search = typeof req.query.search === "string"
      ? req.query.search.trim()
      : "";
    const from = parseDateInput(req.query.from);
    const to = parseDateInput(req.query.to);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 50), 100);

    if (severity && !allowedSeverities.has(severity)) {
      return res.status(400).json({ message: "Invalid severity filter" });
    }

    if (status && !allowedLogStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }

    if (req.query.from && !from) {
      return res.status(400).json({ message: "Invalid from date" });
    }

    if (req.query.to && !to) {
      return res.status(400).json({ message: "Invalid to date" });
    }

    const query = {};
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { event: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      SystemLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
      SystemLog.countDocuments(query)
    ]);

    res.json({
      logs: logs.map((log) => ({
        _id: log._id,
        severity: log.severity,
        event: log.event,
        description: log.description,
        status: log.status,
        timestamp: log.timestamp.toISOString(),
        actorId: log.actorId,
        actorRole: log.actorRole
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("Get system logs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRatingsSummary = async (req, res) => {
  try {
    const topLimit = Math.min(parsePositiveInt(req.query.topLimit, 10), 50);
    const [overview, distribution, topDestinations] = await Promise.all([
      Rating.aggregate([
        {
          $group: {
            _id: null,
            totalRatings: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            lastUpdatedAt: { $max: "$updatedAt" }
          }
        }
      ]),
      Rating.aggregate([
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Rating.aggregate([
        {
          $group: {
            _id: "$destination",
            count: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            lastUpdatedAt: { $max: "$updatedAt" }
          }
        },
        { $sort: { count: -1, averageRating: -1 } },
        { $limit: topLimit },
        {
          $lookup: {
            from: "destinations",
            localField: "_id",
            foreignField: "_id",
            as: "destination"
          }
        },
        { $unwind: { path: "$destination", preserveNullAndEmptyArrays: true } }
      ])
    ]);

    const base = overview[0] || { totalRatings: 0, averageRating: 0, lastUpdatedAt: null };
    const ratingDistribution = [1, 2, 3, 4, 5].map((value) => {
      const found = distribution.find((entry) => entry._id === value);
      return { rating: value, count: found ? found.count : 0 };
    });

    return res.json({
      totalRatings: base.totalRatings,
      averageRating: Number((base.averageRating || 0).toFixed(2)),
      lastUpdatedAt: base.lastUpdatedAt,
      distribution: ratingDistribution,
      topDestinations: topDestinations.map((entry) => ({
        destinationId: entry._id.toString(),
        destinationName: entry.destination?.name || null,
        count: entry.count,
        averageRating: Number((entry.averageRating || 0).toFixed(2)),
        lastUpdatedAt: entry.lastUpdatedAt
      }))
    });
  } catch (err) {
    console.error("Get ratings summary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getRatingsByDestination = async (req, res) => {
  try {
    const destinationId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    const destination = await Destination.findById(destinationId).select("name isActive");
    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const [overview, distribution, recentRatings] = await Promise.all([
      Rating.aggregate([
        { $match: { destination: new mongoose.Types.ObjectId(destinationId) } },
        {
          $group: {
            _id: null,
            totalRatings: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            lastUpdatedAt: { $max: "$updatedAt" }
          }
        }
      ]),
      Rating.aggregate([
        { $match: { destination: new mongoose.Types.ObjectId(destinationId) } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Rating.find({ destination: destinationId })
        .sort({ updatedAt: -1 })
        .limit(Math.min(parsePositiveInt(req.query.limit, 30), 100))
        .populate("user", "fullName email")
    ]);

    const base = overview[0] || { totalRatings: 0, averageRating: 0, lastUpdatedAt: null };
    const ratingDistribution = [1, 2, 3, 4, 5].map((value) => {
      const found = distribution.find((entry) => entry._id === value);
      return { rating: value, count: found ? found.count : 0 };
    });

    return res.json({
      destination: {
        id: destination._id.toString(),
        name: destination.name,
        isActive: destination.isActive
      },
      totalRatings: base.totalRatings,
      averageRating: Number((base.averageRating || 0).toFixed(2)),
      lastUpdatedAt: base.lastUpdatedAt,
      distribution: ratingDistribution,
      ratings: recentRatings.map((entry) => ({
        id: entry._id.toString(),
        userId: entry.user?._id?.toString() || null,
        userName: entry.user?.fullName || null,
        userEmail: entry.user?.email || null,
        rating: entry.rating,
        updatedAt: entry.updatedAt
      }))
    });
  } catch (err) {
    console.error("Get destination ratings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getFeedbackEvents = async (req, res) => {
  try {
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType.trim() : "";
    const destinationId = parseOptionalObjectId(req.query.destinationId);
    const from = parseDateInput(req.query.from);
    const to = parseDateInput(req.query.to);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 50), 200);

    if (req.query.destinationId && destinationId === undefined) {
      return res.status(400).json({ message: "Invalid destinationId" });
    }
    if (req.query.from && !from) {
      return res.status(400).json({ message: "Invalid from date" });
    }
    if (req.query.to && !to) {
      return res.status(400).json({ message: "Invalid to date" });
    }

    const query = {};
    if (eventType) query.eventType = eventType;
    if (destinationId) query.destinationId = destinationId;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      RecommendationFeedback.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecommendationFeedback.countDocuments(query)
    ]);

    return res.json({
      events,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("Get feedback events error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getFeedbackSummary = async (req, res) => {
  try {
    const destinationId = parseOptionalObjectId(req.query.destinationId);
    const from = parseDateInput(req.query.from);
    const to = parseDateInput(req.query.to);

    if (req.query.destinationId && destinationId === undefined) {
      return res.status(400).json({ message: "Invalid destinationId" });
    }
    if (req.query.from && !from) {
      return res.status(400).json({ message: "Invalid from date" });
    }
    if (req.query.to && !to) {
      return res.status(400).json({ message: "Invalid to date" });
    }

    const match = {};
    if (destinationId) match.destinationId = destinationId;
    if (from || to) {
      match.timestamp = {};
      if (from) match.timestamp.$gte = from;
      if (to) match.timestamp.$lte = to;
    }

    const [eventBreakdown, totals] = await Promise.all([
      RecommendationFeedback.aggregate([
        { $match: match },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      RecommendationFeedback.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueSessions: { $addToSet: "$sessionId" },
            uniqueUsers: { $addToSet: "$userId" },
            firstSeenAt: { $min: "$timestamp" },
            lastSeenAt: { $max: "$timestamp" }
          }
        }
      ])
    ]);

    const summary = totals[0] || {
      totalEvents: 0,
      uniqueSessions: [],
      uniqueUsers: [],
      firstSeenAt: null,
      lastSeenAt: null
    };

    return res.json({
      totalEvents: summary.totalEvents,
      uniqueSessionCount: summary.uniqueSessions.filter(Boolean).length,
      uniqueUserCount: summary.uniqueUsers.filter(Boolean).length,
      firstSeenAt: summary.firstSeenAt,
      lastSeenAt: summary.lastSeenAt,
      eventsByType: eventBreakdown.map((item) => ({
        eventType: item._id,
        count: item.count
      }))
    });
  } catch (err) {
    console.error("Get feedback summary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAdminComments = async (req, res) => {
  try {
    const destinationId = parseOptionalObjectId(req.query.destinationId);
    const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
    const from = parseDateInput(req.query.from);
    const to = parseDateInput(req.query.to);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 50), 200);

    if (req.query.destinationId && destinationId === undefined) {
      return res.status(400).json({ message: "Invalid destinationId" });
    }
    if (status && !["visible", "hidden"].includes(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }
    if (req.query.from && !from) {
      return res.status(400).json({ message: "Invalid from date" });
    }
    if (req.query.to && !to) {
      return res.status(400).json({ message: "Invalid to date" });
    }

    const query = {};
    if (destinationId) query.destination = destinationId;
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) query.createdAt.$lte = to;
    }

    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      DestinationComment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("destination", "name")
        .populate("user", "fullName email")
        .lean(),
      DestinationComment.countDocuments(query)
    ]);

    return res.json({
      comments: comments.map((comment) => ({
        id: comment._id.toString(),
        destinationId: comment.destination?._id?.toString() || null,
        destinationName: comment.destination?.name || null,
        userId: comment.user?._id?.toString() || null,
        userName: comment.user?.fullName || null,
        userEmail: comment.user?.email || null,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("Get admin comments error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCloudinaryUploadSignature = async (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const requestedFolder =
      typeof req.body?.folder === "string" ? req.body.folder.trim() : "";
    const folder = requestedFolder || "destinations";
    const rawParams =
      req.body?.paramsToSign && typeof req.body.paramsToSign === "object"
        ? req.body.paramsToSign
        : null;

    const paramsToSign = rawParams
      ? Object.fromEntries(
        Object.entries(rawParams).filter(([, value]) =>
          ["string", "number", "boolean"].includes(typeof value)
        )
      )
      : {};

    if (!Object.prototype.hasOwnProperty.call(paramsToSign, "timestamp")) {
      paramsToSign.timestamp = timestamp;
    }
    if (!Object.prototype.hasOwnProperty.call(paramsToSign, "folder")) {
      paramsToSign.folder = folder;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUD_API_SECRET
    );

    res.json({
      cloudName: process.env.CLOUD_NAME,
      apiKey: process.env.CLOUD_API_KEY,
      timestamp,
      folder,
      signature
    });
  } catch (err) {
    console.error("Cloudinary signature error:", err);
    res.status(500).json({ message: "Failed to generate upload signature" });
  }
};

exports.uploadDestinationImage = async (req, res) => {
  try {
    const { id } = req.params;

    const uploadedImages = Array.isArray(req.body.images)
      ? req.body.images
      : [];

    if (!uploadedImages.length) {
      return res.status(400).json({ message: "No images provided" });
    }

    const destination = await Destination.findByIdAndUpdate(
      id,
      { $push: { images: { $each: uploadedImages } } },
      { new: true }
    );

    res.json(destination);
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: "Image upload failed" });
  }
};

exports.deleteDestinationImage = async (req, res) => {
  const { id, imageIndex } = req.params;

  const destination = await Destination.findById(id);

  const image = destination.images[imageIndex];

  await cloudinary.uploader.destroy(image.publicId);

  destination.images.splice(imageIndex, 1);

  await destination.save();

  res.json(destination);
};

exports.getRoutePreview = async (req, res) => {
  try {
    const {
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
      profile
    } = req.body;

    const parsedStartLatitude = parseCoordinate(startLatitude);
    const parsedStartLongitude = parseCoordinate(startLongitude);
    const parsedEndLatitude = parseCoordinate(endLatitude);
    const parsedEndLongitude = parseCoordinate(endLongitude);

    if (
      parsedStartLatitude === null ||
      parsedStartLongitude === null ||
      parsedEndLatitude === null ||
      parsedEndLongitude === null
    ) {
      return res.status(400).json({
        message: "start/end latitude and longitude are required numbers"
      });
    }

    const route = await getRouteSummary({
      startLatitude: parsedStartLatitude,
      startLongitude: parsedStartLongitude,
      endLatitude: parsedEndLatitude,
      endLongitude: parsedEndLongitude,
      profile
    });

    await logAdminAction(req, {
      severity: "Info",
      event: "Route preview requested",
      description: "Admin requested route preview.",
      status: "Success"
    });

    res.json(route);
  } catch (err) {
    console.error("Route preview error:", err);
    await logAdminAction(req, {
      severity: "Error",
      event: "Route preview failed",
      description: err.message,
      status: "Failed"
    });
    res.status(502).json({
      message: "Mapbox route fetch failed",
      details: err.message
    });
  }
};
