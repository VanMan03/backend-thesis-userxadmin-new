require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { connectDB } = require("../src/db");
const Destination = require("../src/models/Destination");
const {
  resolveDurationHours,
  isValidDurationHours
} = require("../src/utils/durationHours");

const CATEGORY_DEFAULT_DURATION_HOURS = {
  "Nature Tourism": 4,
  "Cultural Tourism": 3,
  "Sun and Beach Tourism": 4,
  "Cruise and Nautical Tourism": 4,
  "Leisure and Entertainment Tourism": 2.5,
  "Diving and Marine Sports Tourism": 4.5,
  "Health, Wellness, and Retirement Tourism": 2.5,
  "MICE and Events Tourism": 3,
  "Education Tourism": 3
};
const FALLBACK_DEFAULT_DURATION_HOURS = 3;

function getCategoryDefaultDurationHours(rawCategories) {
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const defaults = categories
    .map((category) => CATEGORY_DEFAULT_DURATION_HOURS[category])
    .filter((value) => Number.isFinite(value));

  if (!defaults.length) return FALLBACK_DEFAULT_DURATION_HOURS;

  const avg = defaults.reduce((sum, value) => sum + value, 0) / defaults.length;
  return Math.round(avg * 10) / 10;
}

async function main() {
  const applyChanges = process.argv.includes("--apply");

  await connectDB();

  const candidates = await Destination.find({})
    .select("_id name category durationHours estimatedDuration duration")
    .lean();

  let updatedCount = 0;
  let legacyMappedCount = 0;
  let categoryDefaultCount = 0;
  const reviewItems = [];

  for (const destination of candidates) {
    if (isValidDurationHours(destination.durationHours)) {
      continue;
    }

    const legacyValue = resolveDurationHours({
      estimatedDuration: destination.estimatedDuration,
      duration: destination.duration
    });
    const durationHours = legacyValue ?? getCategoryDefaultDurationHours(destination.category);
    const source = legacyValue !== null ? "legacy" : "category-default";

    if (applyChanges) {
      await Destination.updateOne(
        { _id: destination._id },
        { $set: { durationHours } }
      );
    }

    updatedCount += 1;
    if (source === "legacy") legacyMappedCount += 1;
    if (source === "category-default") {
      categoryDefaultCount += 1;
      reviewItems.push({
        id: destination._id.toString(),
        name: destination.name || null,
        category: Array.isArray(destination.category) ? destination.category : [],
        assignedDurationHours: durationHours
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: applyChanges ? "apply" : "dry-run",
    totals: {
      scanned: candidates.length,
      toBackfill: updatedCount,
      mappedFromLegacy: legacyMappedCount,
      mappedFromCategoryDefault: categoryDefaultCount
    },
    categoryDefaults: CATEGORY_DEFAULT_DURATION_HOURS,
    fallbackDefault: FALLBACK_DEFAULT_DURATION_HOURS,
    manualReview: reviewItems
  };

  const reportsDir = path.join(__dirname, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(
    reportsDir,
    `duration-hours-backfill-${Date.now()}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[duration-hours] Mode: ${report.mode}`);
  console.log(`[duration-hours] Scanned: ${report.totals.scanned}`);
  console.log(`[duration-hours] Backfilled: ${report.totals.toBackfill}`);
  console.log(`[duration-hours] From legacy fields: ${report.totals.mappedFromLegacy}`);
  console.log(`[duration-hours] From category defaults: ${report.totals.mappedFromCategoryDefault}`);
  console.log(`[duration-hours] Manual review report: ${filePath}`);
}

main()
  .catch((err) => {
    console.error("[duration-hours] Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
