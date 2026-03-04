//This controller manages user profile and preferences
const User = require("../models/User");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

exports.searchUsers = async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;
    const excludeSelf = req.query.excludeSelf !== "false";

    if (!q) {
      return res.json({ users: [] });
    }

    const query = {
      $or: [
        { fullName: { $regex: escapeRegExp(q), $options: "i" } },
        { email: { $regex: escapeRegExp(q), $options: "i" } }
      ]
    };

    if (excludeSelf) {
      query._id = { $ne: req.user.id };
    }

    const users = await User.find(query)
      .select("_id fullName email")
      .sort({ fullName: 1 })
      .limit(limit);

    return res.json({
      users: users.map((user) => ({
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        label: user.fullName || user.email
      }))
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
