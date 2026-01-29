const mongoose = require("mongoose");

const DestinationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    category: {
      type: String,
      enum: [
        "Nature Tourism",
        "Cultural Tourism",
        "Sun and Beach Tourism",
        "Leisure and Entertainment",
        "Adventure Tourism",
        "Education Tourism"
      ],
      required: true
    },

    features: {
      nature: { type: Number, default: 0 },
      swimming: { type: Number, default: 0 },
      trekking: { type: Number, default: 0 },
      cultural: { type: Number, default: 0 }
    },

    estimatedCost: {
      type: Number,
      required: true
    },

    averageRating: {
      type: Number,
      default: 0
    },

    totalRatings: {
      type: Number,
      default: 0
    },

    location: {
      lat: Number,
      lng: Number
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
