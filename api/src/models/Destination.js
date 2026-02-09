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
    },

images: {
  type: [
    {
      url: String,
      publicId: String
    }
  ],
  validate: [arrayLimit, "Maximum 4 images allowed"]
}


  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
