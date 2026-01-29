//Manages destination data retrieval for users
const Destination = require("../models/Destination");

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
    const destination = await Destination.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    res.json(destination);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
