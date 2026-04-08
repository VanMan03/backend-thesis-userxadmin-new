//Manages destination data retrieval for users
const Destination = require("../models/Destination");
const DestinationTaxonomy = require("../models/DestinationTaxonomy");
const Rating = require("../models/Rating");
const DestinationComment = require("../models/DestinationComment");
const mongoose = require("mongoose");
const { getDefaultValidFeatures, sanitizeValidFeatures } = require("../utils/normalizeFeatures");
const { buildInterestsSchema } = require("../utils/interestsSchema");
const {
  MAIN_INTERESTS,
  SUB_INTERESTS
} = require("../shared/interests");
const {
  upsertUserRatingAndAggregate,
  clearUserRatingAndAggregate,
  withDestinationAggregate
} = require("../services/destinationRatingAggregate");

const COMMENT_MAX_LENGTH = 1000;
const TAXONOMY_KEY = "default";
const BLOCKED_TERMS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "nigger",
  "faggot",
  "puta",
  "tanga",
  "ulol",
  "bobo"
];

function normalizeCommentBody(rawBody) {
  if (typeof rawBody !== "string") return "";
  return rawBody.replace(/\s+/g, " ").trim();
}

function isLikelySpam(text) {
  if (/https?:\/\//i.test(text) || /www\./i.test(text)) return true;
  if (/(.)\1{8,}/.test(text)) return true;
  return false;
}

function containsBlockedTerm(text) {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some((term) => lower.includes(term));
}

async function toLeanResult(queryOrValue) {
  if (queryOrValue && typeof queryOrValue.lean === "function") {
    return queryOrValue.lean();
  }
  return queryOrValue;
}

function buildCanonicalInterestsSchema() {
  const subByMainId = new Map();

  SUB_INTERESTS.forEach((subInterest) => {
    if (!subByMainId.has(subInterest.mainInterestId)) {
      subByMainId.set(subInterest.mainInterestId, []);
    }

    subByMainId.get(subInterest.mainInterestId).push({
      id: subInterest.id,
      label: subInterest.label
    });
  });

  return {
    mainInterests: MAIN_INTERESTS.map((mainInterest) => ({
      id: mainInterest.id,
      label: mainInterest.label,
      subInterests: subByMainId.get(mainInterest.id) || []
    }))
  };
}

function alignSchemaIdsToCanonical(schema) {
  if (!schema || !Array.isArray(schema.mainInterests)) return schema;

  const mainLabelToId = new Map(
    MAIN_INTERESTS.map((item) => [item.label, item.id])
  );
  const subByMainIdAndLabel = new Map(
    SUB_INTERESTS.map((item) => [`${item.mainInterestId}::${item.label}`, item.id])
  );

  schema.mainInterests.forEach((mainInterest) => {
    if (!mainInterest || typeof mainInterest !== "object") return;
    const canonicalMainId = mainLabelToId.get(mainInterest.label);
    if (canonicalMainId) {
      mainInterest.id = canonicalMainId;
    }

    if (!Array.isArray(mainInterest.subInterests)) return;
    const mainIdForLookup = mainInterest.id || canonicalMainId;
    mainInterest.subInterests.forEach((subInterest) => {
      if (!subInterest || typeof subInterest !== "object") return;
      if (!mainIdForLookup) return;
      const canonicalSubId = subByMainIdAndLabel.get(
        `${mainIdForLookup}::${subInterest.label}`
      );
      if (canonicalSubId) {
        subInterest.id = canonicalSubId;
      }
    });
  });

  return schema;
}

exports.getInterestsSchema = async (_req, res) => {
  try {
    const canonicalValidFeatures = getDefaultValidFeatures();

    if (!Object.keys(canonicalValidFeatures).length) {
      console.warn("[destinations/interests-schema] Canonical valid features are empty");
    }

    const [taxonomyDoc, destinations] = await Promise.all([
      toLeanResult(DestinationTaxonomy.findOne({ key: TAXONOMY_KEY })),
      toLeanResult(Destination.find({ isActive: true }))
    ]);

    const runtimeValidFeatures = sanitizeValidFeatures(taxonomyDoc?.validFeatures || {});
    const runtimeSchema = buildInterestsSchema({
      canonicalValidFeatures: {},
      runtimeValidFeatures,
      destinationFeatureObjects: []
    });
    alignSchemaIdsToCanonical(runtimeSchema);

    const runtimeHasSubInterests = runtimeSchema.mainInterests.some(
      (item) => Array.isArray(item.subInterests) && item.subInterests.length > 0
    );

    const responseSchema = runtimeHasSubInterests
      ? runtimeSchema
      : buildCanonicalInterestsSchema();

    res.set("Cache-Control", "no-store");
    res.status(200).json({
      ...responseSchema,
      source: runtimeHasSubInterests ? "runtime" : "canonical",
      diagnostics: {
        runtimeCategoryCount: runtimeSchema.mainInterests.length,
        activeDestinationCount: Array.isArray(destinations) ? destinations.length : 0
      }
    });
  } catch (err) {
    console.error("Get interests schema error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//Get all active destinations (for users)

exports.getAllDestinations = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const destinations = await Destination.find({ isActive: true }).lean();
    res.json(destinations.map((item) => withDestinationAggregate(item)));
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

// Get single destination by ID
exports.getDestinationById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    res.set("Cache-Control", "no-store");
    const destination = await Destination.findOne({
      _id: id,
      isActive: true
    }).lean();

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    res.json(withDestinationAggregate(destination));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.upsertDestinationRating = async (req, res) => {
  try {
    const { destinationId } = req.params;
    const { rating } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }

    const destination = await Destination.findOne({
      _id: destinationId,
      isActive: true
    }).select("_id");

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const { updatedRating, aggregate } = await upsertUserRatingAndAggregate({
      userId: req.user.id,
      destinationId,
      rating
    });

    return res.status(200).json({
      destinationId: updatedRating.destination.toString(),
      userRating: updatedRating.rating,
      updatedAt: updatedRating.updatedAt,
      rating: aggregate.rating,
      reviewCount: aggregate.reviewCount
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyDestinationRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ user: req.user.id })
      .select("destination rating")
      .lean();

    return res.json({
      ratings: ratings.map((item) => ({
        destinationId: item.destination.toString(),
        rating: item.rating
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.clearDestinationRating = async (req, res) => {
  try {
    const { destinationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    const destination = await Destination.findOne({
      _id: destinationId,
      isActive: true
    }).select("_id");

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const aggregate = await clearUserRatingAndAggregate({
      userId: req.user.id,
      destinationId
    });

    return res.status(200).json({
      destinationId,
      rating: aggregate.rating,
      reviewCount: aggregate.reviewCount
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getDestinationComments = async (req, res) => {
  try {
    const { destinationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    const destination = await Destination.findOne({
      _id: destinationId,
      isActive: true
    }).select("_id");

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const comments = await DestinationComment.find({
      destination: destinationId,
      status: "visible"
    })
      .sort({ createdAt: -1 })
      .populate("user", "fullName email")
      .lean();

    return res.json({
      comments: comments.map((comment) => ({
        id: comment._id.toString(),
        destinationId: comment.destination.toString(),
        userId: comment.user?._id?.toString() || null,
        userName: comment.user?.fullName || null,
        userEmail: comment.user?.email || null,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createDestinationComment = async (req, res) => {
  try {
    const { destinationId } = req.params;
    const normalizedBody = normalizeCommentBody(req.body?.body);

    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: "Invalid destination ID" });
    }

    if (!normalizedBody) {
      return res.status(400).json({ message: "body is required" });
    }

    if (normalizedBody.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ message: `body must be ${COMMENT_MAX_LENGTH} characters or less` });
    }

    if (isLikelySpam(normalizedBody)) {
      return res.status(400).json({ message: "Comment looks like spam and was blocked" });
    }

    if (containsBlockedTerm(normalizedBody)) {
      return res.status(400).json({ message: "Comment contains blocked language" });
    }

    const destination = await Destination.findOne({
      _id: destinationId,
      isActive: true
    }).select("_id");

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    const duplicateWindowStart = new Date(Date.now() - 30 * 1000);
    const duplicate = await DestinationComment.exists({
      destination: destinationId,
      user: req.user.id,
      body: normalizedBody,
      createdAt: { $gte: duplicateWindowStart }
    });

    if (duplicate) {
      return res.status(429).json({ message: "Duplicate comment detected. Please wait before sending again." });
    }

    const comment = await DestinationComment.create({
      destination: destinationId,
      user: req.user.id,
      body: normalizedBody
    });

    await comment.populate("user", "fullName email");

    return res.status(201).json({
      id: comment._id.toString(),
      destinationId: comment.destination.toString(),
      userId: comment.user?._id?.toString() || null,
      userName: comment.user?.fullName || null,
      userEmail: comment.user?.email || null,
      body: comment.body,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
