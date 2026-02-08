const VALID_FEATURES = {
  "Nature Tourism": [
    "Eco-Tours",
    "Wilderness Trekking",
    "Volcanic Sites",
    "Caves & Canyons"
  ],

  "Cultural Tourism": [
    "Heritage Tours",
    "Food Tourism",
    "Festival & Events",
    "Arts & Crafts"
  ],

  "Sun and Beach Tourism": [
    "Island Hopping",
    "Beach & Resorts",
    "Surfing & Skimboarding",
    "Coastal Relaxation"
  ],

  "Cruise and Nautical Tourism": [
    "Luxury Cruises",
    "Yachting & Sailing",
    "Ferry Travel",
    "Water Taxi",
  ],

  "Leisure and Entertainment Tourism": [
    "Theme Parks",
    "Nightlife & Bars",
    "Shopping & Retail",
    "Casinos"
  ],

  "Diving and Marine Sports Tourism": [
    "Scuba Diving",
    "Snorkeling",
    "Wreck Diving",
    "Freediving"
  ],

  "Health, Wellness, and Retirement Tourism": [
    "Spa & Retreats",
    "Medical Tourism",
    "Retirement Villages",
    "Beauty & Anti-Aging"
  ],

  "MICE and Events Tourism": [
    "Conventions",
    "Corporate Meetings",
    "Incentive & Team Building",
    "Exhibition"
  ],

  "Education Tourism": [
    "Study Tours",
    "Historical Site Learning",
    "Culinary School",
    "Language Immersion"
  ]
};

function normalizeFeatures(category, selectedFeatures = []) {
  const valid = VALID_FEATURES[category] || [];
  const features = {};

  selectedFeatures.forEach((f) => {
    if (valid.includes(f)) {
      const key = f
        .replace(/&/g, "")
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .toLowerCase();

      features[key] = 1;
    }
  });

  return features;
}

module.exports = { normalizeFeatures };
