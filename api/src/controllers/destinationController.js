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
