const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";

const {
  verifyToken,
  isAdmin,
  isCenterViewer,
} = require("../backend/middleware/auth");

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

test("verifyToken rejects requests without a bearer token", () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Token required" });
});

test("verifyToken attaches decoded users and calls next", () => {
  const token = jwt.sign(
    { id: 7, email: "agent@example.com", role: "AGENT", name: "Agent" },
    process.env.JWT_SECRET,
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;

  verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 7);
  assert.equal(req.user.role, "AGENT");
  assert.equal(res.statusCode, 200);
});

test("isAdmin allows super admins and center admins, and rejects supervisors and agents", () => {
  const superAdminReq = { user: { role: "SUPER_ADMIN" } };
  const adminReq = { user: { role: "ADMIN" } };
  const supervisorReq = { user: { role: "SUPERVISOR" } };
  const agentReq = { user: { role: "AGENT" } };
  const res = createResponse();
  let nextCalled = 0;

  isAdmin(superAdminReq, createResponse(), () => {
    nextCalled += 1;
  });
  isAdmin(adminReq, createResponse(), () => {
    nextCalled += 1;
  });
  isAdmin(supervisorReq, createResponse(), () => {});
  isAdmin(agentReq, res, () => {});

  assert.equal(nextCalled, 2);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Admin access required" });
});

test("isCenterViewer allows supervisors but rejects agents", () => {
  const superAdminReq = { user: { role: "SUPER_ADMIN" } };
  const adminReq = { user: { role: "ADMIN" } };
  const supervisorReq = { user: { role: "SUPERVISOR" } };
  const agentReq = { user: { role: "AGENT" } };
  const res = createResponse();
  let nextCalled = 0;

  isCenterViewer(superAdminReq, createResponse(), () => {
    nextCalled += 1;
  });
  isCenterViewer(adminReq, createResponse(), () => {
    nextCalled += 1;
  });
  isCenterViewer(supervisorReq, createResponse(), () => {
    nextCalled += 1;
  });
  isCenterViewer(agentReq, res, () => {});

  assert.equal(nextCalled, 3);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Center visibility access required" });
});
