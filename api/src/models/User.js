const mongoose = require("mongoose");
const {
  MAIN_INTEREST_IDS,
  SUB_INTEREST_IDS
} = require("../shared/interests");

const PreferenceSchema = new mongoose.Schema(
  {
    natureTourism: { type: Boolean, default: false },
    culturalTourism: { type: Boolean, default: false },
    sunAndBeachTourism: { type: Boolean, default: false },
    cruiseAndNauticalTourism: { type: Boolean, default: false },
    leisureAndEntertainmentTourism: { type: Boolean, default: false },
    divingAndMarineSportsTourism: { type: Boolean, default: false },
    healthWelnessRetirementTourism: { type: Boolean, default: false },
    MICEAndEventsTourism: { type: Boolean, default: false },
    educationTourism: { type: Boolean, default: false },
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
    interestRanks: { 
      type: Map, 
      of: Number, 
      default: new Map(),
      validate: {
        validator: function(ranks) {
          for (const [key, value] of ranks.entries()) {
            if (typeof value !== 'number' || value < 1 || value > 9) {
              return false;
            }
          }
          return true;
        },
        message: 'All rank values must be numbers between 1 and 9'
      }
    }
  },
  { _id: false }
);

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

    preferences: {
  type: PreferenceSchema,
  default: () => ({})
  },


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
