const mongoose = require("mongoose");

const CollaborationInvitationSchema = new mongoose.Schema(
  {
    itinerary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Itinerary",
      required: true,
      index: true
    },
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    collaboratorLabel: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      index: true
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

CollaborationInvitationSchema.index({ itinerary: 1, invitee: 1, status: 1 });

module.exports = mongoose.model("CollaborationInvitation", CollaborationInvitationSchema);
