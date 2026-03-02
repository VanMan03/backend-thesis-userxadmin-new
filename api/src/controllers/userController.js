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

    // Validate interestRanks if provided
    if (preferences && preferences.interestRanks) {
      const { interestRanks } = preferences;
      
      // Convert object to Map for Mongoose if needed
      if (typeof interestRanks === 'object' && !(interestRanks instanceof Map)) {
        preferences.interestRanks = new Map(Object.entries(interestRanks));
      }
      
      // Validate rank values
      if (preferences.interestRanks instanceof Map) {
        for (const [key, value] of preferences.interestRanks.entries()) {
          if (typeof value !== 'number' || value < 1 || value > 9) {
            return res.status(400).json({ 
              message: `Invalid rank value for ${key}. Ranks must be numbers between 1 and 9.` 
            });
          }
        }
      }
    }

    await User.findByIdAndUpdate(req.user.id, { preferences });

    res.json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: "Server error" });
  }
};
