//This controller manages admin operations for destinations
const Destination = require("../models/Destination");

exports.createDestination = async (req, res) => {
  try {
    const destination = await Destination.create(req.body);
    res.status(201).json(destination);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateDestination = async (req, res) => {
  try {
    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(destination);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteDestination = async (req, res) => {
  try {
    await Destination.findByIdAndDelete(req.params.id);
    res.json({ message: "Destination deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
