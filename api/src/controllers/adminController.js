// This controller manages admin operations for destinations
const Destination = require("../models/Destination");
const User = require("../models/User");
const Itinerary = require("../models/Itinerary");
const { normalizeFeatures } = require("../utils/normalizeFeatures");
const cloudinary = require("../config/cloudinary");

exports.createDestination = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      features, // array from frontend
      estimatedCost
    } = req.body;

    const normalizedFeatures = normalizeFeatures(category, features);

    const destination = await Destination.create({
      name,
      description,
      category,
      features: normalizedFeatures,
      estimatedCost,
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
    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      req.body,
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
    const destination = await Destination.findById(req.params.id);

    if (destination.images.length >= 4) {
      return res.status(400).json({ message: "Maximum 4 images only" });
    }

    destination.images.push({
      url: req.file.path,
      publicId: req.file.filename
    });

    await destination.save();

    res.json(destination);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
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

