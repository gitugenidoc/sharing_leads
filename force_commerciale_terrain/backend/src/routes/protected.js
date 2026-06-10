const express = require("express");

const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const leadsRoutes = require("../modules/leads/leads.routes");
const contactsRoutes = require("../modules/contacts/contacts.routes");
const pipelineRoutes = require("../modules/pipeline/pipeline.routes");
const tasksRoutes = require("../modules/tasks/tasks.routes");
const visitsRoutes = require("../modules/visits/visits.routes");
const activitiesRoutes = require("../modules/activities/activities.routes");
const notificationsRoutes = require("../modules/notifications/notifications.routes");
const telephonyProtectedRoutes = require("../modules/telephony/telephony.protected.routes");
const syncRoutes = require("../modules/sync/sync.routes");

const router = express.Router();

router.use("/dashboard", dashboardRoutes);
router.use("/leads", leadsRoutes);
router.use("/contacts", contactsRoutes);
router.use("/pipeline", pipelineRoutes);
router.use("/tasks", tasksRoutes);
router.use("/visits", visitsRoutes);
router.use("/activities", activitiesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/telephony", telephonyProtectedRoutes);
router.use("/sync", syncRoutes);

module.exports = router;
