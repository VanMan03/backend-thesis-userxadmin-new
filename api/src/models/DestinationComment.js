const mongoose = require("mongoose");

const DESTINATION_COMMENT_STATUSES = ["visible", "hidden"];

const DestinationCommentSchema = new mongoose.Schema(
  {
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: DESTINATION_COMMENT_STATUSES,
      default: "visible",
      index: true
    }
  },
  { timestamps: true }
);

DestinationCommentSchema.index({ destination: 1, status: 1, createdAt: -1 });
DestinationCommentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("DestinationComment", DestinationCommentSchema);
module.exports.DESTINATION_COMMENT_STATUSES = DESTINATION_COMMENT_STATUSES;
