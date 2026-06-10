const test = require("node:test");
const assert = require("node:assert/strict");

const snaptelProvider = require("../backend/services/snaptelProvider");

test("snaptelProvider detects whether the campaign webhook is configured", () => {
  delete process.env.SNAPTEL_CAMPAIGN_WEBHOOK_URL;
  assert.equal(snaptelProvider.isConfigured(), false);

  process.env.SNAPTEL_CAMPAIGN_WEBHOOK_URL =
    "https://snaptel-callback-v3.vercel.app/api/webhooks/campaigns/example";
  assert.equal(snaptelProvider.isConfigured(), true);

  delete process.env.SNAPTEL_CAMPAIGN_WEBHOOK_URL;
});

test("buildCampaignPayload includes lead and agent fields for Snaptel", () => {
  delete process.env.SNAPTEL_DATA_MODE;
  const payload = snaptelProvider.buildCampaignPayload({
    client: {
      id: 42,
      prenom: "Sara",
      nom: "Benali",
      tel_gsm: "06 12 34 56 78",
      email: "sara@example.com",
      adresse: "1 rue test",
      ville: "Casablanca",
      code_postal: "20000",
      status: "TO_CALL",
      nom_mutuelle: "Assurex",
      prix_mutuelle: 79,
      notes: "Lead chaud",
      besoins_specifiques: "Dental",
      center_id: 3,
    },
    actor: {
      id: 9,
      name: "Anas",
      email: "anas@example.com",
      phone_number: "+212600001111",
      role: "ADMIN",
    },
    user: {
      id: 9,
      name: "Anas",
      email: "anas@example.com",
      phone_number: "+212600001111",
      role: "ADMIN",
    },
    toNumber: "06 12 34 56 78",
    message: "",
  });

  assert.equal(payload.event, "campaign.trigger");
  assert.equal(payload.source, "shareleads");
  assert.equal(payload.phone, "0612345678");
  assert.equal(payload.firstName, "Sara");
  assert.equal(payload.lastName, "Benali");
  assert.equal(payload.lead.id, 42);
  assert.equal(payload.agent.id, 9);
  assert.equal(payload.agent.phone, "+212600001111");
  assert.equal(payload.metadata.contact_channel, "CALL");
  assert.equal(payload.metadata.voice_carrier, "infinivox");
  assert.equal(payload.metadata.data_mode, "minimal");
  assert.equal(payload.email, undefined);
  assert.equal(payload.lead.email, undefined);
});

test("buildCampaignPayload can include sensitive lead fields explicitly", () => {
  process.env.SNAPTEL_DATA_MODE = "full";

  const payload = snaptelProvider.buildCampaignPayload({
    client: {
      id: 42,
      prenom: "Sara",
      nom: "Benali",
      tel_gsm: "06 12 34 56 78",
      email: "sara@example.com",
      adresse: "1 rue test",
      ville: "Casablanca",
      code_postal: "20000",
      status: "TO_CALL",
      nom_mutuelle: "Assurex",
      prix_mutuelle: 79,
      notes: "Lead chaud",
      besoins_specifiques: "Dental",
      center_id: 3,
    },
    actor: {
      id: 9,
      name: "Anas",
      email: "anas@example.com",
      phone_number: "+212600001111",
      role: "ADMIN",
    },
    user: {
      id: 9,
      name: "Anas",
      email: "anas@example.com",
      phone_number: "+212600001111",
      role: "ADMIN",
    },
    toNumber: "06 12 34 56 78",
    message: "",
  });

  assert.equal(payload.metadata.data_mode, "full");
  assert.equal(payload.email, "sara@example.com");
  assert.equal(payload.agentEmail, "anas@example.com");
  assert.equal(payload.lead.address, "1 rue test");
  assert.equal(payload.lead.notes, "Lead chaud");

  delete process.env.SNAPTEL_DATA_MODE;
});
