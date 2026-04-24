const mongoose = require("mongoose");

const ItinerarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      trim: true,
      default: null
    },

    destinations: [
      {
        destination: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Destination"
        },
        cost: Number,
        hybridScore: Number,
        distanceFromUser: Number,
        durationFromUser: Number
      }
    ],

    days: {
      type: Number,
      required: false,
      min: 1,
      default: null
    },

    selectedDates: {
      type: [String],
      default: undefined
    },

    dayPlans: [
      {
        dayNumber: {
          type: Number,
          required: true,
          min: 1
        },
        destinations: [
          {
            destination: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Destination"
            },
            cost: Number,
            hybridScore: Number,
            distanceFromUser: Number,
            durationFromUser: Number
          }
        ],
        dayCost: {
          type: Number,
          default: 0
        }
      }
    ],

    stops: [
      {
        destinationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Destination"
        },
        day: {
          type: Number,
          min: 1
        },
        sequence: {
          type: Number,
          min: 1
        },
        startTime: {
          type: String,
          default: null
        },
        endTime: {
          type: String,
          default: null
        },
        timezone: {
          type: String,
          default: null
        }
      }
    ],

    totalCost: {
      type: Number,
      required: true
    },

    maxBudget: {
  type: Number,
  required: false
},

budgetMode: {
  type: String,
  enum: ["constrained", "unconstrained"],
  required: true
},

    travelStyle: {
      type: String,
      enum: ["solo", "couple", "friends", "family", "family_group", "team"],
      default: "solo"
    },

    collaboratorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],


    isSaved: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

ItinerarySchema.index({ user: 1, collaboratorIds: 1 });

module.exports = mongoose.model("Itinerary", ItinerarySchema);
