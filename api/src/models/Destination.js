const mongoose = require("mongoose");
const {
  MAIN_INTEREST_IDS,
  SUB_INTEREST_IDS
} = require("../shared/interests");
const {
  LOCATION_SCOPES,
  DEFAULT_LOCATION_SCOPE
} = require("../shared/locationScopes");
const DestinationSchema = new mongoose.Schema(
  {
    name: String,
    description: String,

    locationScope: {
      type: String,
      enum: LOCATION_SCOPES,
      default: DEFAULT_LOCATION_SCOPE
    },


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
    mainInterests: {
      type: [String],
      enum: MAIN_INTEREST_IDS,
      default: []
    },
    subInterests: {
      type: [String],
      enum: SUB_INTEREST_IDS,
      default: []
    },

  estimatedCost: {
  type: Number,
  required: true,
  min: 0,
  default: 0
  },
  durationHours: {
    type: Number,
    min: 0.5,
    max: 12
  },

    location: {
      lat: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      },
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      resolvedAddress: {
        fullAddress: String,
        barangay: String,
        municipality: String,
        province: String,
        country: String,
        postcode: String
      }
    },
    address: {
      purok: String,
      barangay: String,
      municipality: String,
      province: String,
      fullAddress: String
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

DestinationSchema.pre("validate", function syncLocationCoordinateKeys() {
  if (this.location && typeof this.location === "object") {
    if (Number.isFinite(this.location.lat) && !Number.isFinite(this.location.latitude)) {
      this.location.latitude = this.location.lat;
    }
    if (Number.isFinite(this.location.latitude) && !Number.isFinite(this.location.lat)) {
      this.location.lat = this.location.latitude;
    }
    if (Number.isFinite(this.location.lng) && !Number.isFinite(this.location.longitude)) {
      this.location.longitude = this.location.lng;
    }
    if (Number.isFinite(this.location.longitude) && !Number.isFinite(this.location.lng)) {
      this.location.lng = this.location.longitude;
    }
  }
});

module.exports = mongoose.model("Destination", DestinationSchema);
