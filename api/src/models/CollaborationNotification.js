const mongoose = require("mongoose");

const CollaborationNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    type: {
      type: String,
      enum: ["invite", "itinerary_updated", "comment", "system"],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    itineraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Itinerary",
      default: null
    },
    invitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CollaborationInvitation",
      default: null
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

CollaborationNotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("CollaborationNotification", CollaborationNotificationSchema);
