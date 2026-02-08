const Destination = require("../models/Destination");
const { normalizeFeatures } = require("../utils/mormalizeFeatures");

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
    console.error(err);
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

// SOFT DELETE
exports.deleteDestination = async (req, res) => {
  try {
    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    res.json({ message: "Destination deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
