const mongoose = require("mongoose");

const ItinerarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    destinations: [
      {
        destination: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Destination"
        },
        cost: Number,
        hybridScore: Number
      }
    ],

    days: {
      type: Number,
      required: false,
      min: 1,
      default: null
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
            hybridScore: Number
          }
        ],
        dayCost: {
          type: Number,
          default: 0
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


    isSaved: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Itinerary", ItinerarySchema);
