const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const Rating = require("../models/Rating");

function normalizeAggregate(result) {
  const reviewCount = result?.reviewCount || 0;
  const averageRaw = result?.rating || 0;
  const rating = reviewCount > 0 ? Number(averageRaw.toFixed(2)) : 0;
  return { rating, reviewCount };
}

async function recomputeDestinationRatingAggregate(destinationId) {
  if (!mongoose.Types.ObjectId.isValid(destinationId)) {
    return { rating: 0, reviewCount: 0 };
  }

  const objectId = new mongoose.Types.ObjectId(destinationId);
  const [result] = await Rating.aggregate([
    { $match: { destination: objectId } },
    {
      $group: {
        _id: null,
        reviewCount: { $sum: 1 },
        rating: { $avg: "$rating" }
      }
    }
  ]);

  const aggregate = normalizeAggregate(result);
  await Destination.findByIdAndUpdate(objectId, { $set: aggregate });
  return aggregate;
}

function withDestinationAggregate(destination) {
  if (!destination || typeof destination !== "object") return destination;
  return {
    ...destination,
    rating: Number.isFinite(destination.rating) ? destination.rating : 0,
    reviewCount: Number.isFinite(destination.reviewCount) ? destination.reviewCount : 0
  };
}

module.exports = {
  recomputeDestinationRatingAggregate,
  withDestinationAggregate
};
