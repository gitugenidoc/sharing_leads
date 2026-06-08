const test = require("node:test");
const assert = require("node:assert/strict");

const {
  __test__: {
    normalizeSnaptelPayload,
    normalizeDirection,
    normalizeStatus,
    isSecretAuthorized,
  },
} = require("../backend/routes/snaptel");

test("normalizeStatus converts dotted and spaced values to upper snake case", () => {
  assert.equal(normalizeStatus("call.completed"), "CALL_COMPLETED");
  assert.equal(normalizeStatus("call answered"), "CALL_ANSWERED");
  assert.equal(normalizeStatus(""), "RECEIVED");
});

test("normalizeDirection recognizes inbound and outbound variants", () => {
  assert.equal(normalizeDirection("inbound"), "INBOUND");
  assert.equal(normalizeDirection("agent"), "OUTBOUND");
  assert.equal(normalizeDirection(""), "INBOUND");
});

test("normalizeSnaptelPayload extracts campaign, call ids and phones", () => {
  const payload = normalizeSnaptelPayload({
    event: "call.completed",
    direction: "outbound",
    call: {
      id: "call_42",
      from: "+212600000001",
      to: "+212600000002",
      duration: 92,
    },
    campaign: {
      id: "cmp_42",
      name: "Test campagne",
    },
    summary: "Rappel confirme",
  });

  assert.equal(payload.status, "CALL_COMPLETED");
  assert.equal(payload.direction, "OUTBOUND");
  assert.equal(payload.callId, "call_42");
  assert.equal(payload.campaignId, "cmp_42");
  assert.equal(payload.campaignName, "Test campagne");
  assert.equal(payload.fromNumber, "+212600000001");
  assert.equal(payload.toNumber, "+212600000002");
  assert.equal(payload.durationSeconds, 92);
  assert.deepEqual(payload.phoneCandidates, ["+212600000001", "+212600000002"]);
  assert.match(payload.note, /CALL_COMPLETED/);
});

test("isSecretAuthorized accepts configured header and bearer token", () => {
  process.env.SNAPTEL_WEBHOOK_SECRET = "super-secret";
  assert.equal(
    isSecretAuthorized({
      headers: { "x-snaptel-secret": "super-secret", authorization: "" },
      query: {},
      body: {},
    }),
    true,
  );
  assert.equal(
    isSecretAuthorized({
      headers: { authorization: "Bearer super-secret" },
      query: {},
      body: {},
    }),
    true,
  );
  assert.equal(
    isSecretAuthorized({
      headers: {},
      query: {},
      body: {},
    }),
    false,
  );
  delete process.env.SNAPTEL_WEBHOOK_SECRET;
});
