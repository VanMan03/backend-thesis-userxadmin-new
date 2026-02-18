const mongoose = require("mongoose");

const FEEDBACK_EVENT_TYPES = [
  "recommendation_requested",
  "recommendation_impression",
  "destination_added",
  "destination_removed",
  "itinerary_saved",
  "saved_itinerary_viewed",
  "saved_itinerary_updated",
  "saved_itinerary_deleted"
];

const RecommendationFeedbackSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: FEEDBACK_EVENT_TYPES,
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      default: null,
      index: true
    },
    userEmail: {
      type: String,
      default: null,
      index: true
    },
    destinationId: {
      type: String,
      default: null,
      index: true
    },
    itineraryId: {
      type: String,
      default: null,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RecommendationFeedback", RecommendationFeedbackSchema);
