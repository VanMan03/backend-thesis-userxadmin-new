const mongoose = require("mongoose");

const PreferenceSchema = new mongoose.Schema({
  nature: { type: Boolean, default: false },
  beach: { type: Boolean, default: false },
  trekking: { type: Boolean, default: false },
  swimming: { type: Boolean, default: false },
  cultural: { type: Boolean, default: false },
  adventure: { type: Boolean, default: false }
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    preferences: PreferenceSchema,

    activityScore: {
      type: Number,
      default: 0
    },

    itineraryRequests: {
      type: Number,
      default: 0
    },

    ratingsCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
