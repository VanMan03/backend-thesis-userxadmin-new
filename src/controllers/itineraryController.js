//Handles itinerary creation and retrieval for users
const Itinerary = require("../models/Itinerary");

exports.createItinerary = async (req, res) => {
  try {
    const { destinations, totalCost, maxBudget } = req.body;

    const itinerary = await Itinerary.create({
      user: req.user.id,
      destinations,
      totalCost,
      maxBudget
    });

    res.status(201).json(itinerary);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ user: req.user.id })
      .populate("destinations.destination");

    res.json(itineraries);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
