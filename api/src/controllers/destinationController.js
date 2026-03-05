//Manages destination data retrieval for users
const Destination = require("../models/Destination");
const Rating = require("../models/Rating");
const mongoose = require("mongoose");

//Get all active destinations (for users)

exports.getAllDestinations = async (_req, res) => {
  try {
    const destinations = await Destination.find({ isActive: true });
    res.json(destinations);
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

    const destination = await Destination.findOne({
      _id: id,
      isActive: true
    });

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    res.json(destination);
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

    const updatedRating = await Rating.findOneAndUpdate(
      {
        user: req.user.id,
        destination: destinationId
      },
      { $set: { rating } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      destinationId: updatedRating.destination.toString(),
      rating: updatedRating.rating,
      updatedAt: updatedRating.updatedAt
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
