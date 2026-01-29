const mongoose = require("mongoose");

const UserInteractionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination"
    },

    action: {
      type: String,
      enum: ["view", "click", "save", "remove"]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserInteraction", UserInteractionSchema);
