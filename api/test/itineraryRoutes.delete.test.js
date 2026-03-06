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
const originalFindOne = Itinerary.findOne;
const originalDeleteOne = Itinerary.deleteOne;
const originalUpdateOne = Itinerary.updateOne;

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
  Itinerary.findOne = originalFindOne;
  Itinerary.deleteOne = originalDeleteOne;
  Itinerary.updateOne = originalUpdateOne;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("DELETE /api/itineraries/:id returns 400 for invalid itinerary id", async () => {
  let called = false;
  Itinerary.findOne = async () => {
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

  Itinerary.findOne = async (query) => {
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
  assert.equal(querySeen.$or[0].user, authUserId);
});

test("DELETE /api/itineraries/:id deletes a user itinerary and returns 200", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  let querySeen = null;
  let deleteQuerySeen = null;

  Itinerary.findOne = async (query) => {
    querySeen = query;
    return { _id: itineraryId, user: authUserId };
  };
  Itinerary.deleteOne = async (query) => {
    deleteQuerySeen = query;
    return { acknowledged: true, deletedCount: 1 };
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
  assert.equal(querySeen.$or[0].user, authUserId);
  assert.equal(deleteQuerySeen._id, itineraryId);
});

test("DELETE /api/itineraries/:id hides itinerary for collaborator and returns 200", async () => {
  const itineraryId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();
  let updateQuerySeen = null;
  let updateSeen = null;

  Itinerary.findOne = async () => ({
    _id: itineraryId,
    user: ownerId
  });
  Itinerary.updateOne = async (query, update) => {
    updateQuerySeen = query;
    updateSeen = update;
    return { acknowledged: true, modifiedCount: 1 };
  };

  const response = await fetch(`${baseUrl}/api/itineraries/${itineraryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message, "Itinerary removed from your account");
  assert.equal(updateQuerySeen._id, itineraryId);
  assert.equal(updateSeen.$addToSet.hiddenFor, authUserId);
  assert.equal(updateSeen.$pull.collaboratorIds, authUserId);
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
