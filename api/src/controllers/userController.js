//This controller manages user profile and preferences
const User = require("../models/User");
const { createSystemLog } = require("../services/systemLogService");
const {
  normalizeMainInterestIds,
  normalizeSubInterestIds
} = require("../shared/interests");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function logUserEvent(req, payload) {
  await createSystemLog({
    ...payload,
    actorId: req.user?.id || null,
    actorRole: req.user?.role || "user",
    metadata: {
      path: req.originalUrl,
      method: req.method,
      ...(payload.metadata || {})
    }
  });
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
    const nextPreferences = preferences && typeof preferences === "object"
      ? { ...preferences }
      : {};

    if (Object.prototype.hasOwnProperty.call(nextPreferences, "mainInterests")) {
      const normalizedMainInterests = normalizeMainInterestIds(nextPreferences.mainInterests);
      if (
        Array.isArray(nextPreferences.mainInterests) &&
        normalizedMainInterests.length !== nextPreferences.mainInterests.length
      ) {
        return res.status(400).json({ message: "Invalid mainInterests IDs" });
      }
      nextPreferences.mainInterests = normalizedMainInterests;
    }

    if (Object.prototype.hasOwnProperty.call(nextPreferences, "subInterests")) {
      const normalizedSubInterests = normalizeSubInterestIds(nextPreferences.subInterests);
      if (
        Array.isArray(nextPreferences.subInterests) &&
        normalizedSubInterests.length !== nextPreferences.subInterests.length
      ) {
        return res.status(400).json({ message: "Invalid subInterests IDs" });
      }
      nextPreferences.subInterests = normalizedSubInterests;
    }

    // Validate interestRanks if provided
    if (nextPreferences && nextPreferences.interestRanks) {
      const { interestRanks } = nextPreferences;
      
      // Convert object to Map for Mongoose if needed
      if (typeof interestRanks === 'object' && !(interestRanks instanceof Map)) {
        nextPreferences.interestRanks = new Map(Object.entries(interestRanks));
      }
      
      // Validate rank values
      if (nextPreferences.interestRanks instanceof Map) {
        for (const [key, value] of nextPreferences.interestRanks.entries()) {
          if (typeof value !== 'number' || value < 1 || value > 9) {
            await logUserEvent(req, {
              severity: "Warning",
              event: "Preference validation failed",
              description: `Invalid rank for ${key}`,
              status: "Failed"
            });
            return res.status(400).json({ 
              message: `Invalid rank value for ${key}. Ranks must be numbers between 1 and 9.` 
            });
          }
        }
      }
    }

    await User.findByIdAndUpdate(req.user.id, { preferences: nextPreferences });
    await logUserEvent(req, {
      severity: "Info",
      event: "Preferences updated",
      description: "User updated preferences.",
      status: "Success"
    });

    res.json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error('Error updating preferences:', error);
    await logUserEvent(req, {
      severity: "Error",
      event: "Preferences update failed",
      description: error.message,
      status: "Failed"
    });
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
