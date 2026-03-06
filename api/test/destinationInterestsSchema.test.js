const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const db = require("../src/db");
db.connectDB = async () => {};

const app = require("../src/app");
const Destination = require("../src/models/Destination");
const DestinationTaxonomy = require("../src/models/DestinationTaxonomy");

const originalDestinationFind = Destination.find;
const originalTaxonomyFindOne = DestinationTaxonomy.findOne;

let server;
let baseUrl;

test.before(async () => {
  DestinationTaxonomy.findOne = async () => ({
    key: "default",
    validFeatures: {
      "Nature Tourism": ["Eco-Tours", "Wilderness Trekking"]
    }
  });

  Destination.find = async () => ([
    {
      isActive: true,
      category: ["Nature Tourism"],
      features: {
        "Nature Tourism": {
          ecotours: 1,
          wildernesstrekking: 1
        }
      }
    }
  ]);

  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  Destination.find = originalDestinationFind;
  DestinationTaxonomy.findOne = originalTaxonomyFindOne;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/destinations/interests-schema returns complete mainInterests schema", async () => {
  const response = await fetch(`${baseUrl}/api/destinations/interests-schema`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.mainInterests));
  assert.ok(body.mainInterests.length > 0);

  body.mainInterests.forEach((entry) => {
    assert.equal(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0);
    assert.ok(Array.isArray(entry.subInterests));
  });

  const hasNonEmptySubInterests = body.mainInterests.some(
    (entry) => Array.isArray(entry.subInterests) && entry.subInterests.length > 0
  );
  assert.equal(hasNonEmptySubInterests, true);
});

test("GET /api/destinations/interests-schema response is stable between calls", async () => {
  const first = await fetch(`${baseUrl}/api/destinations/interests-schema`);
  const second = await fetch(`${baseUrl}/api/destinations/interests-schema`);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);

  const firstBody = await first.json();
  const secondBody = await second.json();
  assert.deepEqual(secondBody, firstBody);
});
