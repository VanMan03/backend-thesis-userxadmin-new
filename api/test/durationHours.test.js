const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseDurationHoursFromPayload,
  resolveDurationHours,
  applyDurationHoursCompatibility
} = require("../src/utils/durationHours");

test("parseDurationHoursFromPayload accepts numeric and legacy duration keys", () => {
  assert.deepEqual(parseDurationHoursFromPayload({ durationHours: 2.5 }), {
    hasAnyDurationInput: true,
    value: 2.5
  });

  assert.deepEqual(parseDurationHoursFromPayload({ estimatedDuration: "3" }), {
    hasAnyDurationInput: true,
    value: 3
  });

  assert.deepEqual(parseDurationHoursFromPayload({ duration: "4 hours" }), {
    hasAnyDurationInput: true,
    value: 4
  });
});

test("parseDurationHoursFromPayload rejects out-of-range values", () => {
  assert.throws(
    () => parseDurationHoursFromPayload({ durationHours: 0.25 }),
    /durationHours must be a number between 0.5 and 12/
  );
});

test("resolveDurationHours maps legacy fields when durationHours is missing", () => {
  const durationHours = resolveDurationHours({
    estimatedDuration: "2.5 hours"
  });
  assert.equal(durationHours, 2.5);
});

test("applyDurationHoursCompatibility injects normalized durationHours", () => {
  const output = applyDurationHoursCompatibility({
    name: "Sample",
    duration: "5"
  });

  assert.equal(output.durationHours, 5);
});
