const mongoose = require("mongoose");

const DestinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    features: {
      type: Object, // 👈 safest for your use case
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
