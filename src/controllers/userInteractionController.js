const UserInteraction = require("../models/UsersInteraction");

exports.logInteraction = async (req, res) => {
  try {
    const { destinationId, action } = req.body;

    await UserInteraction.create({
      user: req.user.id,
      destination: destinationId,
      action
    });

    res.status(201).json({ message: "Interaction logged" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

