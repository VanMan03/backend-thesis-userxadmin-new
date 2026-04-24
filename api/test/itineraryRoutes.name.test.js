const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const db = require("../src/db");
db.connectDB = async () => {};

const app = require("../src/app");
const User = require("../src/models/User");
const Itinerary = require("../src/models/Itinerary");

const originalFindById = User.findById;
const originalCreate = Itinerary.create;
const originalFindOne = Itinerary.findOne;

const authUserId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: authUserId }, process.env.JWT_SECRET);

let server;
let baseUrl;

function makeAuthedUser(id) {
  return {
    select: async () => ({
      _id: id,
      role: "user",
      fullName: "Test User"
    })
  };
}

test.before(async () => {
  User.findById = (id) => makeAuthedUser(id);

  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  User.findById = originalFindById;
  Itinerary.create = originalCreate;
  Itinerary.findOne = originalFindOne;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/itineraries rejects whitespace name with 400", async () => {
  let createCalled = false;
  Itinerary.create = async () => {
    createCalled = true;
    return null;
  };

  const response = await fetch(`${baseUrl}/api/itineraries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "   ",
      totalCost: 0
    })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "name is required and cannot be empty");
  assert.equal(createCalled, false);
});

test("POST /api/itineraries persists and returns normalized name", async () => {
  let payloadSeen = null;
  Itinerary.create = async (payload) => {
    payloadSeen = payload;
    return {
      _id: new mongoose.Types.ObjectId(),
      user: payload.user,
      name: payload.name,
      destinations: payload.destinations,
      days: payload.days,
      selectedDates: payload.selectedDates,
      dayPlans: payload.dayPlans,
      stops: payload.stops,
      totalCost: payload.totalCost,
      maxBudget: payload.maxBudget,
      budgetMode: payload.budgetMode,
      travelStyle: payload.travelStyle,
      collaboratorIds: payload.collaboratorIds,
      isSaved: payload.isSaved,
      toObject() {
        return { ...this };
      }
    };
  };

  const response = await fetch(`${baseUrl}/api/itineraries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "  Summer Trip  ",
      totalCost: 0
    })
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payloadSeen.name, "Summer Trip");
  assert.equal(body.name, "Summer Trip");
});

test("PATCH /api/itineraries/:id updates name independently and returns persisted name", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  Itinerary.findOne = async () => ({
    _id: itineraryId,
    user: authUserId,
    collaboratorIds: [],
    name: "Old Name",
    destinations: [],
    days: null,
    selectedDates: [],
    dayPlans: [],
    stops: [],
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    async save() {
      this.updatedAt = new Date("2026-01-02T00:00:00.000Z");
      return this;
    },
    toObject() {
      return { ...this };
    }
  });

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "  Renamed Itinerary  "
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.name, "Renamed Itinerary");
});

test("PATCH /api/itineraries/:id rejects whitespace name with 400", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  Itinerary.findOne = async () => ({
    _id: itineraryId,
    user: authUserId,
    collaboratorIds: [],
    name: "Current Name",
    destinations: [],
    days: null,
    selectedDates: [],
    dayPlans: [],
    stops: [],
    async save() {
      return this;
    }
  });

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "   "
    })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "name is required and cannot be empty");
});
