const DestinationSchema = new mongoose.Schema(
  {
    name: String,
    description: String,

    category: {
      type: String,
      required: true // e.g. "Nature Tourism"
    },

    features: {
      type: Object,
      required: true
      // e.g. { wildernessTrekking: 1, ecoTours: 1 }
    },

    estimatedCost: Number,

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
