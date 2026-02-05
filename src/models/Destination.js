const mongoose = require("mongoose");

const DestinationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    category: {
      type: String,
      enum: [
        "Nature Tourism",
        "Cultural Tourism",
        "Sun and Beach Tourism",
        "Leisure and Entertainment",
        "Adventure Tourism",
        "Education Tourism"
      ],
      required: true
    },

    features: {
      ecoTours: { type: Number, default: 0 },
      wildernessTrekking: { type: Number, default: 0 },
      volcanicSites: { type: Number, default: 0 },
      cavesCanyons: { type: Number, default: 0 },
      heritageTours: { type: Number, default: 0 },
      foodTourism: { type: Number, default: 0 },
      festivalEvents: { type: Number, default: 0 },
      artsCrafts: { type: Number, default: 0 },
      islandHoping: { type: Number, default: 0 },
      beachResorts: { type: Number, default: 0 },
      surfingSkimboarding: { type: Number, default: 0 },
      coastalRelaxation: { type: Number, default: 0 },
      luxuryCruises: { type: Number, default: 0 },
      yachtingSailing: { type: Number, default: 0 },
      ferryTravel: { type: Number, default: 0 },
      waterTaxi: { type: Number, default: 0 },
      themeParks: { type: Number, default: 0 },
      nightlifeBars: { type: Number, default: 0 },
      shoppingRetail: { type: Number, default: 0 },
      casinos: { type: Number, default: 0 },
      scubaDiving: { type: Number, default: 0 },
      snorkeling: { type: Number, default: 0 },
      wreckDiving: { type: Number, default: 0 },
      freediving: { type: Number, default: 0 },
      spaRetreats: { type: Number, default: 0 },
      medicalTourism: { type: Number, default: 0 },
      retirementVillages: { type: Number, default: 0 },
      beautyAntiAging: { type: Number, default: 0 },
      conventions: { type: Number, default: 0 },  
      corporateMeetings: { type: Number, default: 0 },
      incentiveTeamBuilding: { type: Number, default: 0 },
      exhibition: { type: Number, default: 0 },
      studyTours: { type: Number, default: 0 },   
      historicalSiteLearning: { type: Number, default: 0 },
      culturalSchool: { type: Number, default: 0 },
      languageImmersion: { type: Number, default: 0 }
    },

    estimatedCost: {
      type: Number,
      required: true
    },

    averageRating: {
      type: Number,
      default: 0
    },

    totalRatings: {
      type: Number,
      default: 0
    },

    location: {
      lat: Number,
      lng: Number
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
