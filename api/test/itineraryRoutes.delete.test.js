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
const originalFindOneAndDelete = Itinerary.findOneAndDelete;

const authUserId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: authUserId }, process.env.JWT_SECRET);

let server;
let baseUrl;

test.before(async () => {
  User.findById = (id) => ({
    select: async () => ({
      _id: id,
      role: "user"
    })
  });

  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  User.findById = originalFindById;
  Itinerary.findOneAndDelete = originalFindOneAndDelete;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("DELETE /api/itineraries/:id returns 400 for invalid itinerary id", async () => {
  let called = false;
  Itinerary.findOneAndDelete = async () => {
    called = true;
    return null;
  };

  const response = await fetch(`${baseUrl}/api/itineraries/not-a-valid-id`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid itinerary ID");
  assert.equal(called, false);
});

test("DELETE /api/itineraries/:id returns 404 when itinerary does not exist for user", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  let querySeen = null;

  Itinerary.findOneAndDelete = async (query) => {
    querySeen = query;
    return null;
  };

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.message, "Itinerary not found");
  assert.equal(querySeen._id, itineraryId);
  assert.equal(querySeen.user, authUserId);
});

test("DELETE /api/itineraries/:id deletes a user itinerary and returns 200", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  let querySeen = null;

  Itinerary.findOneAndDelete = async (query) => {
    querySeen = query;
    return { _id: itineraryId };
  };

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message, "Itinerary deleted successfully");
  assert.equal(querySeen._id, itineraryId);
  assert.equal(querySeen.user, authUserId);
});

test("DELETE /api/itineraries/:id returns 401 when token is missing", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "DELETE"
  });

  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, "No token provided");
});

test("DELETE /api/itineraries/:id returns 401 for invalid token", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer invalid-token"
    }
  });

  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, "Invalid or expired token");
});
