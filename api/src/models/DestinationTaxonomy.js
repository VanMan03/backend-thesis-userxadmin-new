const mongoose = require("mongoose");

const DestinationTaxonomySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default"
    },

    validFeatures: {
      type: Object,
      required: true,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DestinationTaxonomy", DestinationTaxonomySchema);
