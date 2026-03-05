const mongoose = require("mongoose");

const SystemLogSchema = new mongoose.Schema(
  {
    severity: {
      type: String,
      enum: ["Error", "Warning", "Info", "Success"],
      required: true,
      default: "Info"
    },
    event: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["Success", "Warning", "Failed"],
      required: true,
      default: "Success"
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    actorRole: {
      type: String,
      default: null,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    versionKey: false
  }
);

SystemLogSchema.index({ timestamp: -1 });
SystemLogSchema.index({ severity: 1, timestamp: -1 });
SystemLogSchema.index({ event: 1 });

module.exports = mongoose.model("SystemLog", SystemLogSchema);
