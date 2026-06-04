const express = require("express");
const pool = require("../config/db");
const { verifyToken, isCenterViewer } = require("../middleware/auth");

const router = express.Router();

const SUCCESS_STATUSES = ["SIGNED", "CLOSED"];
const FAILURE_STATUSES = ["LOST", "REFUSED"];
const OPEN_STATUSES = [
  "NEW",
  "TO_CALL",
  "UNREACHABLE",
  "CALLBACK_SCHEDULED",
  "QUOTE_SENT",
  "INTERESTED",
  "CONTACTED",
  "QUALIFIED",
];

const isSuperAdmin = (user) => user.role === "SUPER_ADMIN";

const normalizeNumber = (value) => Number(value || 0);

const normalizeOverview = (row = {}) => ({
  totalClients: normalizeNumber(row.total_clients),
  assignedClients: normalizeNumber(row.assigned_clients),
  unassignedClients: normalizeNumber(row.unassigned_clients),
  activeClients: normalizeNumber(row.active_clients),
  closedClients: normalizeNumber(row.closed_clients),
  lostClients: normalizeNumber(row.lost_clients),
  totalPrixMutuelle: normalizeNumber(row.total_prix_mutuelle),
  closedPrixMutuelle: normalizeNumber(row.closed_prix_mutuelle),
  overdueReminders: normalizeNumber(row.overdue_reminders),
  dueToday: normalizeNumber(row.due_today),
  staleClients: normalizeNumber(row.stale_clients),
  averageScore: normalizeNumber(row.average_score),
  closeRate: normalizeNumber(row.close_rate),
});

const normalizeAgent = (row = {}) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  centerId: row.center_id,
  centerName: row.center_name,
  assignedClients: normalizeNumber(row.assigned_clients),
  activeClients: normalizeNumber(row.active_clients),
  closedClients: normalizeNumber(row.closed_clients),
  lostClients: normalizeNumber(row.lost_clients),
  quoteSentClients: normalizeNumber(row.quote_sent_clients),
  interestedClients: normalizeNumber(row.interested_clients),
  overdueReminders: normalizeNumber(row.overdue_reminders),
  staleClients: normalizeNumber(row.stale_clients),
  contactedClients: normalizeNumber(row.contacted_clients),
  untouchedClients: normalizeNumber(row.untouched_clients),
  totalPrixMutuelle: normalizeNumber(row.total_prix_mutuelle),
  closedPrixMutuelle: normalizeNumber(row.closed_prix_mutuelle),
  closeRate: normalizeNumber(row.close_rate),
  lastActionAt: row.last_action_at,
});

const buildClientScope = (user, query, alias = "clients") => {
  const params = [];
  const clauses = [];
  const centerId = isSuperAdmin(user)
    ? parseInt(query.centerId || query.center_id, 10) || null
    : user.center_id || -1;

  if (centerId) {
    params.push(centerId);
    clauses.push(`${alias}.center_id = $${params.length}`);
  }
  if (query.from) {
    params.push(query.from);
    clauses.push(`${alias}.created_at >= $${params.length}::date`);
  }
  if (query.to) {
    params.push(query.to);
    clauses.push(`${alias}.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return {
    params,
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    and: clauses.length ? `AND ${clauses.join(" AND ")}` : "",
    centerId,
  };
};

const buildAgentScope = (user, query) => {
  const params = [];
  const clauses = ["users.role = 'AGENT'"];
  const centerId = isSuperAdmin(user)
    ? parseInt(query.centerId || query.center_id, 10) || null
    : user.center_id || -1;

  if (centerId) {
    params.push(centerId);
    clauses.push(`users.center_id = $${params.length}`);
  }

  return {
    params,
    where: `WHERE ${clauses.join(" AND ")}`,
    centerId,
  };
};

const getOverview = async (scope) => {
  const result = await pool.query(
    `
      SELECT
        COUNT(*) AS total_clients,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) AS assigned_clients,
        COUNT(*) FILTER (WHERE assigned_to IS NULL) AS unassigned_clients,
        COUNT(*) FILTER (WHERE status = ANY($${scope.params.length + 1})) AS closed_clients,
        COUNT(*) FILTER (WHERE status = ANY($${scope.params.length + 2})) AS lost_clients,
        COUNT(*) FILTER (WHERE status = ANY($${scope.params.length + 3})) AS active_clients,
        COALESCE(SUM(COALESCE(prix_mutuelle, 0)), 0) AS total_prix_mutuelle,
        COALESCE(SUM(COALESCE(prix_mutuelle, 0)) FILTER (WHERE status = ANY($${scope.params.length + 1})), 0) AS closed_prix_mutuelle,
        COUNT(*) FILTER (
          WHERE reminder_at IS NOT NULL
            AND reminder_at < NOW()
            AND status <> ALL($${scope.params.length + 4})
        ) AS overdue_reminders,
        COUNT(*) FILTER (
          WHERE reminder_at IS NOT NULL
            AND reminder_at::date = CURRENT_DATE
            AND status <> ALL($${scope.params.length + 4})
        ) AS due_today,
        COUNT(*) FILTER (
          WHERE assigned_to IS NOT NULL
            AND status <> ALL($${scope.params.length + 4})
            AND (last_action_at IS NULL OR last_action_at < NOW() - INTERVAL '48 hours')
        ) AS stale_clients,
        COALESCE(ROUND(AVG(COALESCE(nlp_score, 0)), 1), 0) AS average_score,
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status = ANY($${scope.params.length + 1}))::numeric / COUNT(*)::numeric) * 100, 1)
        END AS close_rate
      FROM clients
      ${scope.where}
    `,
    [
      ...scope.params,
      SUCCESS_STATUSES,
      FAILURE_STATUSES,
      OPEN_STATUSES,
      [...SUCCESS_STATUSES, ...FAILURE_STATUSES],
    ],
  );
  return normalizeOverview(result.rows[0]);
};

const getStatusBreakdown = async (scope) => {
  const result = await pool.query(
    `
      SELECT status, COUNT(*) AS count, COALESCE(SUM(COALESCE(prix_mutuelle, 0)), 0) AS total_prix_mutuelle
      FROM clients
      ${scope.where}
      GROUP BY status
      ORDER BY count DESC, status ASC
    `,
    scope.params,
  );
  return result.rows.map((row) => ({
    status: row.status,
    count: normalizeNumber(row.count),
    totalPrixMutuelle: normalizeNumber(row.total_prix_mutuelle),
  }));
};

const getAgentPerformance = async (user, query) => {
  const agentScope = buildAgentScope(user, query);
  const params = [...agentScope.params];
  const joinClauses = [];

  if (query.from) {
    params.push(query.from);
    joinClauses.push(`clients.created_at >= $${params.length}::date`);
  }
  if (query.to) {
    params.push(query.to);
    joinClauses.push(`clients.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const successParam = params.length + 1;
  const failureParam = params.length + 2;
  const openParam = params.length + 3;
  const finalParam = params.length + 4;

  const result = await pool.query(
    `
      SELECT
        users.id,
        users.name,
        users.email,
        users.center_id,
        centers.name AS center_name,
        COUNT(clients.id) AS assigned_clients,
        COUNT(clients.id) FILTER (WHERE clients.status = ANY($${openParam})) AS active_clients,
        COUNT(clients.id) FILTER (WHERE clients.status = ANY($${successParam})) AS closed_clients,
        COUNT(clients.id) FILTER (WHERE clients.status = ANY($${failureParam})) AS lost_clients,
        COUNT(clients.id) FILTER (WHERE clients.status = 'QUOTE_SENT') AS quote_sent_clients,
        COUNT(clients.id) FILTER (WHERE clients.status = 'INTERESTED') AS interested_clients,
        COUNT(clients.id) FILTER (
          WHERE clients.reminder_at IS NOT NULL
            AND clients.reminder_at < NOW()
            AND clients.status <> ALL($${finalParam})
        ) AS overdue_reminders,
        COUNT(clients.id) FILTER (
          WHERE clients.status <> ALL($${finalParam})
            AND (clients.last_action_at IS NULL OR clients.last_action_at < NOW() - INTERVAL '48 hours')
        ) AS stale_clients,
        COUNT(clients.id) FILTER (WHERE clients.last_contacted_at IS NOT NULL) AS contacted_clients,
        COUNT(clients.id) FILTER (WHERE clients.last_contacted_at IS NULL) AS untouched_clients,
        COALESCE(SUM(COALESCE(clients.prix_mutuelle, 0)), 0) AS total_prix_mutuelle,
        COALESCE(SUM(COALESCE(clients.prix_mutuelle, 0)) FILTER (WHERE clients.status = ANY($${successParam})), 0) AS closed_prix_mutuelle,
        MAX(clients.last_action_at) AS last_action_at,
        CASE
          WHEN COUNT(clients.id) = 0 THEN 0
          ELSE ROUND((COUNT(clients.id) FILTER (WHERE clients.status = ANY($${successParam}))::numeric / COUNT(clients.id)::numeric) * 100, 1)
        END AS close_rate
      FROM users
      LEFT JOIN centers ON centers.id = users.center_id
      LEFT JOIN clients ON clients.assigned_to = users.id
        ${joinClauses.length ? `AND ${joinClauses.join(" AND ")}` : ""}
      ${agentScope.where}
      GROUP BY users.id, users.name, users.email, users.center_id, centers.name
      ORDER BY closed_clients DESC, overdue_reminders ASC, assigned_clients DESC, users.name ASC
    `,
    [
      ...params,
      SUCCESS_STATUSES,
      FAILURE_STATUSES,
      OPEN_STATUSES,
      [...SUCCESS_STATUSES, ...FAILURE_STATUSES],
    ],
  );

  return result.rows.map(normalizeAgent);
};

const getAlerts = async (scope) => {
  const finalParam = scope.params.length + 1;
  const result = await pool.query(
    `
      SELECT
        clients.id,
        clients.nom,
        clients.prenom,
        clients.status,
        clients.prix_mutuelle,
        clients.reminder_at,
        clients.last_action_at,
        clients.assigned_to,
        users.name AS agent_name
      FROM clients
      LEFT JOIN users ON users.id = clients.assigned_to
      ${scope.where}
        ${scope.where ? "AND" : "WHERE"} (
          (
            clients.reminder_at IS NOT NULL
            AND clients.reminder_at < NOW()
            AND clients.status <> ALL($${finalParam})
          )
          OR (
            clients.assigned_to IS NOT NULL
            AND clients.status <> ALL($${finalParam})
            AND (clients.last_action_at IS NULL OR clients.last_action_at < NOW() - INTERVAL '48 hours')
          )
        )
      ORDER BY
        CASE
          WHEN clients.reminder_at IS NOT NULL AND clients.reminder_at < NOW() THEN 0
          ELSE 1
        END,
        COALESCE(clients.reminder_at, clients.last_action_at, clients.created_at) ASC
      LIMIT 25
    `,
    [...scope.params, [...SUCCESS_STATUSES, ...FAILURE_STATUSES]],
  );
  return result.rows.map((row) => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    status: row.status,
    prixMutuelle: normalizeNumber(row.prix_mutuelle),
    reminderAt: row.reminder_at,
    lastActionAt: row.last_action_at,
    assignedTo: row.assigned_to,
    agentName: row.agent_name,
  }));
};

const getAgentStatusBreakdown = async (user, query, agentId) => {
  const scope = buildClientScope(user, query);
  const params = [...scope.params, agentId];
  const assignedClause = `clients.assigned_to = $${params.length}`;
  const result = await pool.query(
    `
      SELECT status, COUNT(*) AS count, COALESCE(SUM(COALESCE(prix_mutuelle, 0)), 0) AS total_prix_mutuelle
      FROM clients
      ${scope.where ? `${scope.where} AND ${assignedClause}` : `WHERE ${assignedClause}`}
      GROUP BY status
      ORDER BY count DESC, status ASC
    `,
    params,
  );
  return result.rows.map((row) => ({
    status: row.status,
    count: normalizeNumber(row.count),
    totalPrixMutuelle: normalizeNumber(row.total_prix_mutuelle),
  }));
};

const getAgentClients = async (user, query, agentId) => {
  const scope = buildClientScope(user, query);
  const limit = Math.min(parseInt(query.limit, 10) || 100, 500);
  const params = [...scope.params, agentId, [...SUCCESS_STATUSES, ...FAILURE_STATUSES], limit];
  const assignedParam = params.length - 2;
  const finalParam = params.length - 1;
  const limitParam = params.length;
  const assignedClause = `clients.assigned_to = $${assignedParam}`;

  const result = await pool.query(
    `
      SELECT
        clients.id,
        clients.nom,
        clients.prenom,
        clients.email,
        clients.tel_gsm,
        clients.tel_fixe,
        clients.ville,
        clients.status,
        clients.prix_mutuelle,
        clients.reminder_at,
        clients.last_action_at,
        clients.last_contacted_at,
        clients.created_at
      FROM clients
      ${scope.where ? `${scope.where} AND ${assignedClause}` : `WHERE ${assignedClause}`}
      ORDER BY
        CASE
          WHEN clients.reminder_at IS NOT NULL
            AND clients.reminder_at < NOW()
            AND clients.status <> ALL($${finalParam}) THEN 0
          WHEN clients.status <> ALL($${finalParam})
            AND (clients.last_action_at IS NULL OR clients.last_action_at < NOW() - INTERVAL '48 hours') THEN 1
          ELSE 2
        END,
        COALESCE(clients.last_action_at, clients.reminder_at, clients.created_at) DESC
      LIMIT $${limitParam}
    `,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    email: row.email,
    telGsm: row.tel_gsm,
    telFixe: row.tel_fixe,
    ville: row.ville,
    status: row.status,
    prixMutuelle: normalizeNumber(row.prix_mutuelle),
    reminderAt: row.reminder_at,
    lastActionAt: row.last_action_at,
    lastContactedAt: row.last_contacted_at,
    createdAt: row.created_at,
  }));
};

router.get("/center", verifyToken, isCenterViewer, async (req, res) => {
  try {
    const scope = buildClientScope(req.user, req.query);
    const [overview, statusBreakdown, agents, alerts] = await Promise.all([
      getOverview(scope),
      getStatusBreakdown(scope),
      getAgentPerformance(req.user, req.query),
      getAlerts(scope),
    ]);

    res.json({
      centerId: scope.centerId,
      period: {
        from: req.query.from || null,
        to: req.query.to || null,
      },
      overview,
      statusBreakdown,
      agents,
      alerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/agents", verifyToken, isCenterViewer, async (req, res) => {
  try {
    const agents = await getAgentPerformance(req.user, req.query);
    res.json({ agents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/agent/:id", verifyToken, isCenterViewer, async (req, res) => {
  try {
    const agentId = parseInt(req.params.id, 10);
    const agents = await getAgentPerformance(req.user, req.query);
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const [statusBreakdown, clients] = await Promise.all([
      getAgentStatusBreakdown(req.user, req.query, agentId),
      getAgentClients(req.user, req.query, agentId),
    ]);
    res.json({ agent, statusBreakdown, clients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
