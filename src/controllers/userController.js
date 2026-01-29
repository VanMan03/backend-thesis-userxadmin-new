//This controller manages user profile and preferences
const User = require("../models/User");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;

    await User.findByIdAndUpdate(req.user.id, { preferences });

    res.json({ message: "Preferences updated" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
