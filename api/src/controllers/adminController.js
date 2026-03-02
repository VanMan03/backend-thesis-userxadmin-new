// This controller manages admin operations for destinations
const Destination = require("../models/Destination");
const DestinationTaxonomy = require("../models/DestinationTaxonomy");
const User = require("../models/User");
const Itinerary = require("../models/Itinerary");
const {
  normalizeFeatures,
  normalizeCategories,
  normalizeFeatureList,
  sanitizeValidFeatures,
  getDefaultValidFeatures
} = require("../utils/normalizeFeatures");
const cloudinary = require("../config/cloudinary");
const {
  getRouteSummary,
  reverseGeocode
} = require("../services/mapboxService");

const TAXONOMY_KEY = "default";

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTaxonomyKey(value) {
  if (typeof value !== "string") return "";
  return decodeURIComponent(value).trim();
}

function filterSupportedCategories(categories, validFeaturesMap) {
  const allowed = new Set(Object.keys(validFeaturesMap));
  return categories.filter((item) => allowed.has(item));
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
      estimatedCost,
      latitude,
      longitude
    } = req.body;

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        message: "latitude and longitude are required numbers"
      });
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      return res.status(400).json({ message: "latitude must be between -90 and 90" });
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ message: "longitude must be between -180 and 180" });
    }

    const validFeaturesMap = await getValidFeaturesMap();
    const normalizedCategories = filterSupportedCategories(
      normalizeCategories(categories ?? category),
      validFeaturesMap
    );

    if (!normalizedCategories.length) {
      return res.status(400).json({
        message: "At least one valid category is required"
      });
    }

    const normalizedFeatures = normalizeFeatures(
      normalizedCategories,
      features,
      validFeaturesMap
    );

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
        return res.status(502).json({
          message: "Mapbox address resolution failed",
          details: mapboxErr.message
        });
      }
    }

    const uploadedImages = (req.files || []).map((file) => ({
      url: file.path || file.secure_url,
      publicId: file.filename || file.public_id
    }));

    const destination = await Destination.create({
      name,
      description,
      category: normalizedCategories,
      features: normalizedFeatures,
      estimatedCost,
      location: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      },
      images: uploadedImages,
      isActive: true
    });

    res.status(201).json(destination);
  } catch (err) {
    console.error("Create destination error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// EDIT
exports.updateDestination = async (req, res) => {
  try {
    const updates = { ...req.body };

    const hasLatitude = Object.prototype.hasOwnProperty.call(updates, "latitude");
    const hasLongitude = Object.prototype.hasOwnProperty.call(updates, "longitude");

    if (hasLatitude || hasLongitude) {
      const parsedLatitude = parseCoordinate(updates.latitude);
      const parsedLongitude = parseCoordinate(updates.longitude);

      if (parsedLatitude === null || parsedLongitude === null) {
        return res.status(400).json({
          message: "latitude and longitude are required together as numbers"
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
          return res.status(502).json({
            message: "Mapbox address resolution failed",
            details: mapboxErr.message
          });
        }
      }

      updates.location = {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      };
      delete updates.latitude;
      delete updates.longitude;
    }

    const hasCategoryUpdate =
      Object.prototype.hasOwnProperty.call(updates, "category") ||
      Object.prototype.hasOwnProperty.call(updates, "categories");
    const hasFeaturesUpdate = Object.prototype.hasOwnProperty.call(updates, "features");

    if (hasCategoryUpdate || hasFeaturesUpdate) {
      const existingDestination = await Destination.findById(req.params.id);
      if (!existingDestination) {
        return res.status(404).json({ message: "Destination not found" });
      }

      const validFeaturesMap = await getValidFeaturesMap();
      const sourceCategories = hasCategoryUpdate
        ? updates.categories ?? updates.category
        : existingDestination.category;

      const normalizedCategories = filterSupportedCategories(
        normalizeCategories(sourceCategories),
        validFeaturesMap
      );

      if (!normalizedCategories.length) {
        return res.status(400).json({
          message: "At least one valid category is required"
        });
      }

      let normalizedFeatures = existingDestination.features || {};
      if (hasFeaturesUpdate) {
        normalizedFeatures = normalizeFeatures(
          normalizedCategories,
          updates.features,
          validFeaturesMap
        );

        if (!Object.keys(normalizedFeatures).length) {
          return res.status(400).json({
            message: "At least one valid feature is required"
          });
        }
      } else if (normalizedFeatures && typeof normalizedFeatures === "object") {
        const nestedFeatureMap = Object.values(normalizedFeatures).some((value) =>
          value && typeof value === "object" && !Array.isArray(value)
        );

        if (nestedFeatureMap) {
          normalizedFeatures = Object.fromEntries(
            Object.entries(normalizedFeatures).filter(([cat]) =>
              normalizedCategories.includes(cat)
            )
          );
        }
      }

      updates.category = normalizedCategories;
      updates.features = normalizedFeatures;
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

    res.json(destination);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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

    res.json({ message: "Destination deactivated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllDestinationsAdmin = async (req, res) => {
  try {
    const destinations = await Destination.find();
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllItineraries = async (_req, res) => {
  try {
    const itineraries = await Itinerary.find()
      .populate("user", "name email")
      .populate("destinations.destination", "name");

    res.json(itineraries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadDestinationImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const uploadedImages = req.files.map((file) => ({
      url: file.path || file.secure_url,
      publicId: file.filename || file.public_id
    }));

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

    res.json(route);
  } catch (err) {
    console.error("Route preview error:", err);
    res.status(502).json({
      message: "Mapbox route fetch failed",
      details: err.message
    });
  }
};
