const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");
const SnaptelIntegration = require("../models/SnaptelIntegration");
const PhoneCall = require("../models/PhoneCall");
const Client = require("../models/Client");
const User = require("../models/User");
const { processSnaptelCallEvent } = require("../services/snaptelWebhookService");
const { subscribeCallEvents } = require("../services/callEventBus");
const { getWebhookSecret } = require("../models/SnaptelIntegration");

const router = express.Router();

const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const resolveCenterId = (user, requestedCenterId = null) => {
  if (user.role === "SUPER_ADMIN") {
    return requestedCenterId || user.center_id || null;
  }
  return user.center_id;
};

const requireCenterId = (res, centerId) => {
  if (!centerId) {
    res.status(400).json({ error: "center_id_required" });
    return false;
  }
  return true;
};

const buildWebhookUrl = (req, centerId) => {
  const base =
    toText(process.env.APP_BASE_URL) ||
    `${req.protocol}://${req.get("host")}`;
  const suffix = centerId ? `?center_id=${centerId}` : "";
  return `${base.replace(/\/$/, "")}/api/webhooks/snaptel/call-event${suffix}`;
};

router.get("/snaptel", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(
      req.user,
      parseInt(req.query.center_id, 10) || null,
    );
    if (!requireCenterId(res, centerId)) return;

    let integration = await SnaptelIntegration.getIntegrationByCenterId(centerId);
    if (!integration) {
      integration = await SnaptelIntegration.upsertIntegration(centerId, {
        sda_did: "332510",
        sip_domain: "68.183.12.18",
        sip_server: "68.183.12.18",
      });
    }

    const mappings = await SnaptelIntegration.getAgentMappings(centerId);
    const logs = await SnaptelIntegration.getWebhookLogs(centerId, 30);
    const unrecognized = await PhoneCall.getUnrecognizedCalls(centerId, 20);

    return res.json({
      integration: {
        ...integration,
        webhook_url: buildWebhookUrl(req, centerId),
        provider: "Snaptel",
      },
      agent_mappings: mappings,
      webhook_logs: logs,
      unrecognized_calls: unrecognized,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/snaptel", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(
      req.user,
      parseInt(req.body.center_id, 10) || null,
    );
    if (!requireCenterId(res, centerId)) return;

    const status = req.body.enabled
      ? "ACTIVE"
      : req.body.enabled === false
        ? "NOT_CONFIGURED"
        : undefined;

    const integration = await SnaptelIntegration.upsertIntegration(centerId, {
      enabled: req.body.enabled,
      name: req.body.name,
      sda_did: req.body.sda_did,
      sip_domain: req.body.sip_domain,
      sip_server: req.body.sip_server,
      sip_transport: req.body.sip_transport,
      sip_port: req.body.sip_port,
      config_notes: req.body.config_notes,
      status,
    });

    return res.json({
      integration: {
        ...integration,
        webhook_url: buildWebhookUrl(req, centerId),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/regenerate-secret", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(
      req.user,
      parseInt(req.body.center_id, 10) || null,
    );
    if (!requireCenterId(res, centerId)) return;

    let integration = await SnaptelIntegration.getIntegrationByCenterId(centerId);
    if (!integration) {
      integration = await SnaptelIntegration.upsertIntegration(centerId, {});
    }

    const result = await SnaptelIntegration.regenerateWebhookSecret(centerId);
    if (!result) {
      return res.status(404).json({ error: "integration_not_found" });
    }

    return res.json({
      integration: {
        ...result.integration,
        webhook_url: buildWebhookUrl(req, centerId),
      },
      webhook_secret: result.secret,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/snaptel/agent-mappings", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(
      req.user,
      parseInt(req.body.center_id, 10) || null,
    );
    if (!requireCenterId(res, centerId)) return;

    const mappings = Array.isArray(req.body.mappings) ? req.body.mappings : [];
    const saved = [];
    for (const item of mappings) {
      if (!item.user_id) continue;
      const user = await User.getUserById(item.user_id);
      if (!user || user.center_id !== centerId) continue;
      saved.push(
        await SnaptelIntegration.upsertAgentMapping(centerId, item.user_id, {
          snaptel_extension: item.snaptel_extension,
          snaptel_agent_id: item.snaptel_agent_id,
          sda_line: item.sda_line,
          active: item.active,
        }),
      );
    }

    return res.json({ mappings: saved });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/snaptel/webhook-logs/:id/payload", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const payload = await SnaptelIntegration.getWebhookLogPayload(
      req.params.id,
      centerId,
    );
    if (!payload) return res.status(404).json({ error: "log_not_found" });
    return res.json({ payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/snaptel/unrecognized", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const calls = await PhoneCall.getUnrecognizedCalls(centerId, 50);
    return res.json({ calls });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/calls/:id/link", verifyToken, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const clientId = parseInt(req.body.client_id, 10);
    if (!clientId) return res.status(400).json({ error: "client_id_required" });

    const client = await Client.getClientById(clientId);
    if (!client || client.center_id !== centerId) {
      return res.status(404).json({ error: "client_not_found" });
    }

    const call = await PhoneCall.linkCallToClient(req.params.id, centerId, clientId);
    if (!call) return res.status(404).json({ error: "call_not_found" });

    await Client.addClientHistory({
      clientId,
      userId: req.user.id,
      action: "SNAPTEL_CALL_EVENT",
      oldValue: {},
      newValue: { phone_call_id: call.id, linked_manually: true },
      note: `Appel Snaptel rattache manuellement`,
    });

    return res.json({ call });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/calls/:id/ignore", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const call = await PhoneCall.ignoreCall(req.params.id, centerId);
    if (!call) return res.status(404).json({ error: "call_not_found" });
    return res.json({ call });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/calls/:id/notes", verifyToken, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const call = await PhoneCall.addAgentNotes(
      req.params.id,
      centerId,
      toText(req.body.notes),
    );
    if (!call) return res.status(404).json({ error: "call_not_found" });
    if (call.matched_client_id) {
      await Client.addClientHistory({
        clientId: call.matched_client_id,
        userId: req.user.id,
        action: "SNAPTEL_CALL_EVENT",
        oldValue: {},
        newValue: { phone_call_id: call.id, notes: call.agent_notes },
        note: call.agent_notes,
      });
    }
    return res.json({ call });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/calls/:id/resolve-match", verifyToken, async (req, res) => {
  try {
    const centerId = resolveCenterId(req.user);
    if (!requireCenterId(res, centerId)) return;
    const clientId = parseInt(req.body.client_id, 10);
    if (!clientId) return res.status(400).json({ error: "client_id_required" });

    const call = await PhoneCall.linkCallToClient(req.params.id, centerId, clientId);
    if (!call) return res.status(404).json({ error: "call_not_found" });

    await Client.addClientHistory({
      clientId,
      userId: req.user.id,
      action: "SNAPTEL_CALL_EVENT",
      oldValue: {},
      newValue: { phone_call_id: call.id, resolved_from_multiple: true },
      note: "Appel Snaptel - fiche choisie par l'agent",
    });

    return res.json({ call });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/snaptel/test/simulate", verifyToken, isAdmin, async (req, res) => {
  try {
    const centerId = resolveCenterId(
      req.user,
      parseInt(req.body.center_id, 10) || null,
    );
    if (!requireCenterId(res, centerId)) return;

    const integration = await SnaptelIntegration.getIntegrationByCenterId(centerId);
    if (!integration) {
      return res.status(400).json({ error: "integration_not_configured" });
    }

    const fullRow = await SnaptelIntegration.getIntegrationById(integration.id);
    const secret = await getWebhookSecret(fullRow);

    const scenario = toText(req.body.scenario) || "incoming_known";
    const testCallId = `test_${Date.now()}`;

    let payload;
    if (scenario === "unrecognized") {
      payload = {
        call_id: testCallId,
        event_type: "incoming_call",
        direction: "inbound",
        caller_number: "+33999999999",
        callee_number: integration.sda_did || "332510",
        sda: integration.sda_did || "332510",
        agent_extension: req.body.agent_extension || "101",
        is_test: true,
      };
    } else {
      const client = await pool.query(
        `SELECT * FROM clients WHERE center_id = $1
         AND (tel_gsm IS NOT NULL OR tel_fixe IS NOT NULL)
         ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [centerId],
      );
      const phone = client.rows[0]?.tel_gsm || client.rows[0]?.tel_fixe || "+33601020304";
      payload = {
        call_id: testCallId,
        event_type: "incoming_call",
        direction: "inbound",
        caller_number: phone,
        callee_number: integration.sda_did || "332510",
        sda: integration.sda_did || "332510",
        agent_extension: req.body.agent_extension || "101",
        is_test: true,
      };
    }

    const result = await processSnaptelCallEvent({
      payload,
      providedSecret: secret,
      centerIdHint: centerId,
      isTest: true,
    });

    return res.status(result.status).json({
      ...result.body,
      test_payload: payload,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/snaptel/call-events/stream", async (req, res) => {
  const jwt = require("jsonwebtoken");
  const token =
    req.query.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.user = user;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const userId = req.user.id;
  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: "connected", user_id: userId });

  const unsubscribe = subscribeCallEvents(userId, (payload) => {
    send({ type: "call_event", ...payload });
  });

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
