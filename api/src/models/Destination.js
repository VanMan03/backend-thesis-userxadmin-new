const mongoose = require("mongoose");
const DestinationSchema = new mongoose.Schema(
  {
    name: String,
    description: String,

    category: {
      type: [String],
      required: true,
      validate: {
        validator: (val) => Array.isArray(val) && val.length > 0
      }
      // e.g. ["Nature Tourism", "Cultural Tourism"]
    },

    features: {
      type: Object,
      required: true
      // e.g. { "Nature Tourism": { ecoTours: 1, wildernessTrekking: 1 } }
    },

  estimatedCost: {
  type: Number,
  required: true,
  min: 0,
  default: 0
  },

    location: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      },
      resolvedAddress: {
        fullAddress: String,
        barangay: String,
        city: String,
        province: String,
        country: String,
        postcode: String
      }
    },

    isActive: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },

images: {
  type: [
    {
      url: String,
      publicId: String
    }
  ]

}


  },
  { timestamps: true }
);

DestinationSchema.path("images").validate(function (val) {
  return val.length <= 4;
}, "Maximum of 4 images allowed");

module.exports = mongoose.model("Destination", DestinationSchema);
