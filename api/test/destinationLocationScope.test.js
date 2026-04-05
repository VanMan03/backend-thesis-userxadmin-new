const test = require("node:test");
const assert = require("node:assert/strict");

const Destination = require("../src/models/Destination");
const DestinationTaxonomy = require("../src/models/DestinationTaxonomy");
const SystemLog = require("../src/models/SystemLog");
const {
  createDestination,
  updateDestination
} = require("../src/controllers/adminController");

function buildRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

const basePayload = {
  name: "Test Destination",
  description: "Test",
  category: ["Nature Tourism"],
  features: {
    "Nature Tourism": {
      ecotours: 1
    }
  },
  estimatedCost: 100,
  location: {
    lat: 12.34,
    lng: 123.45
  }
};

test("Destination schema defaults locationScope to IN_BULUSAN", () => {
  const doc = new Destination(basePayload);
  assert.equal(doc.locationScope, "IN_BULUSAN");
});

test("createDestination accepts valid locationScope", async () => {
  const originalCreate = Destination.create;
  const originalFindOne = DestinationTaxonomy.findOne;
  const originalSystemLogCreate = SystemLog.create;

  let createPayload = null;

  try {
    DestinationTaxonomy.findOne = async () => ({
      key: "default",
      validFeatures: {
        "Nature Tourism": ["Eco-Tours"]
      }
    });
    SystemLog.create = async () => ({ _id: "log" });
    Destination.create = async (payload) => {
      createPayload = payload;
      return { ...payload, _id: "dest1" };
    };

    const req = {
      body: {
        ...basePayload,
        locationScope: "SORSOGON"
      },
      user: { id: "admin1", role: "admin" },
      originalUrl: "/api/admin/destinations",
      method: "POST"
    };
    const res = buildRes();

    await createDestination(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(createPayload);
    assert.equal(createPayload.locationScope, "SORSOGON");
  } finally {
    Destination.create = originalCreate;
    DestinationTaxonomy.findOne = originalFindOne;
    SystemLog.create = originalSystemLogCreate;
  }
});

test("createDestination rejects invalid locationScope", async () => {
  const originalCreate = Destination.create;

  let createCalled = false;

  try {
    Destination.create = async () => {
      createCalled = true;
      return { _id: "dest1" };
    };

    const req = {
      body: {
        ...basePayload,
        locationScope: "NOT_VALID"
      },
      user: { id: "admin1", role: "admin" },
      originalUrl: "/api/admin/destinations",
      method: "POST"
    };
    const res = buildRes();

    await createDestination(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(createCalled, false);
    assert.match(res.body.message, /locationScope/i);
  } finally {
    Destination.create = originalCreate;
  }
});

test("updateDestination accepts locationScope updates", async () => {
  const originalUpdate = Destination.findByIdAndUpdate;
  const originalSystemLogCreate = SystemLog.create;

  let updatePayload = null;

  try {
    SystemLog.create = async () => ({ _id: "log" });
    Destination.findByIdAndUpdate = async (_id, updates) => {
      updatePayload = updates;
      return { _id, name: "Updated Destination" };
    };

    const req = {
      params: { id: "dest1" },
      body: { locationScope: "NEAR_BULUSAN" },
      user: { id: "admin1", role: "admin" },
      originalUrl: "/api/admin/destinations/dest1",
      method: "PUT"
    };
    const res = buildRes();

    await updateDestination(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(updatePayload);
    assert.equal(updatePayload.locationScope, "NEAR_BULUSAN");
  } finally {
    Destination.findByIdAndUpdate = originalUpdate;
    SystemLog.create = originalSystemLogCreate;
  }
});

test("updateDestination rejects invalid locationScope", async () => {
  const originalUpdate = Destination.findByIdAndUpdate;

  let updateCalled = false;

  try {
    Destination.findByIdAndUpdate = async () => {
      updateCalled = true;
      return { _id: "dest1", name: "Updated Destination" };
    };

    const req = {
      params: { id: "dest1" },
      body: { locationScope: "BAD" },
      user: { id: "admin1", role: "admin" },
      originalUrl: "/api/admin/destinations/dest1",
      method: "PUT"
    };
    const res = buildRes();

    await updateDestination(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(updateCalled, false);
    assert.match(res.body.message, /locationScope/i);
  } finally {
    Destination.findByIdAndUpdate = originalUpdate;
  }
});
