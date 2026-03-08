const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const Rating = require("../models/Rating");
const { applyDurationHoursCompatibility } = require("../utils/durationHours");

function normalizeAggregate(result) {
  const reviewCount = Number(result?.reviewCount || 0);
  const averageRaw = result?.rating || 0;
  const rating = reviewCount > 0 ? Number(averageRaw.toFixed(2)) : 0;
  return { rating, reviewCount };
}

async function recomputeDestinationRatingAggregate(destinationId, session = null) {
  if (!mongoose.Types.ObjectId.isValid(destinationId)) {
    return { rating: 0, reviewCount: 0 };
  }

  const objectId = new mongoose.Types.ObjectId(destinationId);
  const aggregateQuery = Rating.aggregate([
    { $match: { destination: objectId } },
    {
      $group: {
        _id: null,
        reviewCount: { $sum: 1 },
        rating: { $avg: "$rating" }
      }
    }
  ]);
  if (session) aggregateQuery.session(session);
  const [result] = await aggregateQuery;

  const aggregate = normalizeAggregate(result);
  await Destination.findByIdAndUpdate(objectId, { $set: aggregate }, { session });
  return aggregate;
}

async function upsertUserRatingAndAggregate({ userId, destinationId, rating }) {
  const session = await mongoose.startSession();
  let output = null;
  try {
    await session.withTransaction(async () => {
      const updatedRating = await Rating.findOneAndUpdate(
        { user: userId, destination: destinationId },
        { $set: { rating } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      const aggregate = await recomputeDestinationRatingAggregate(destinationId, session);
      output = { updatedRating, aggregate };
    });
    return output;
  } catch (err) {
    // Local/dev standalone Mongo does not support transactions; keep writes consistent best-effort.
    if (err?.codeName === "IllegalOperation" || /Transaction numbers are only allowed/i.test(err?.message || "")) {
      const updatedRating = await Rating.findOneAndUpdate(
        { user: userId, destination: destinationId },
        { $set: { rating } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const aggregate = await recomputeDestinationRatingAggregate(destinationId);
      return { updatedRating, aggregate };
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

async function clearUserRatingAndAggregate({ userId, destinationId }) {
  const session = await mongoose.startSession();
  try {
    let aggregate = null;
    await session.withTransaction(async () => {
      await Rating.findOneAndDelete({
        user: userId,
        destination: destinationId
      }, { session });
      aggregate = await recomputeDestinationRatingAggregate(destinationId, session);
    });
    return aggregate;
  } catch (err) {
    if (err?.codeName === "IllegalOperation" || /Transaction numbers are only allowed/i.test(err?.message || "")) {
      await Rating.findOneAndDelete({
        user: userId,
        destination: destinationId
      });
      return recomputeDestinationRatingAggregate(destinationId);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function withDestinationAggregate(destination) {
  if (!destination || typeof destination !== "object") return destination;
  const withDurationHours = applyDurationHoursCompatibility(destination);
  return {
    ...withDurationHours,
    rating: Number.isFinite(withDurationHours.rating) ? withDurationHours.rating : 0,
    reviewCount: Number.isFinite(withDurationHours.reviewCount) ? withDurationHours.reviewCount : 0
  };
}

module.exports = {
  recomputeDestinationRatingAggregate,
  upsertUserRatingAndAggregate,
  clearUserRatingAndAggregate,
  withDestinationAggregate
};
