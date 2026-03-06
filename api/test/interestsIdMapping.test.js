const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeMainInterestIds,
  normalizeSubInterestIds
} = require("../src/shared/interests");

test("normalizeMainInterestIds accepts main-* ids and maps to canonical IDs", () => {
  const normalized = normalizeMainInterestIds([
    "main-nature-tourism",
    "nature"
  ]);

  assert.deepEqual(normalized, ["nature"]);
});

test("normalizeSubInterestIds accepts sub-* ids and maps to canonical IDs", () => {
  const normalized = normalizeSubInterestIds([
    "sub-nature-tourism-ecotours",
    "eco_tours"
  ]);

  assert.deepEqual(normalized, ["eco_tours"]);
});
