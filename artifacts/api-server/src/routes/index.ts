import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import tenantRouter from "./tenant.js";
import clientsRouter from "./clients.js";
import projectsRouter from "./projects.js";
import keywordsRouter from "./keywords.js";
import clustersRouter from "./clusters.js";
import topicMapRouter from "./topic-map.js";
import aiTasksRouter from "./ai-tasks.js";
import briefsRouter from "./briefs.js";
import reportsRouter from "./reports.js";
import billingRouter from "./billing.js";
import teamRouter from "./team.js";
import auditLogRouter from "./audit-log.js";
import apiKeysRouter from "./api-keys.js";
import webhooksRouter from "./webhooks.js";
import integrationsRouter from "./integrations.js";
import notificationsRouter from "./notifications.js";
import calendarRouter from "./calendar.js";
import commentsRouter from "./comments.js";
import competitorsRouter from "./competitors.js";
import rankingsRouter from "./rankings.js";
import templatesRouter from "./templates.js";
import customFieldsRouter from "./custom-fields.js";
import exportRouter from "./export.js";
import reportSchedulesRouter from "./report-schedules.js";
import analyticsRouter from "./analytics.js";
import usageRouter from "./usage.js";
import gdprRouter from "./gdpr.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tenantRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(keywordsRouter);
router.use(clustersRouter);
router.use(topicMapRouter);
router.use(aiTasksRouter);
router.use(briefsRouter);
router.use(reportsRouter);
router.use(billingRouter);
router.use(teamRouter);
router.use(auditLogRouter);
router.use(apiKeysRouter);
router.use(webhooksRouter);
router.use(integrationsRouter);
router.use(notificationsRouter);
router.use(calendarRouter);
router.use(commentsRouter);
router.use(competitorsRouter);
router.use(rankingsRouter);
router.use(templatesRouter);
router.use(customFieldsRouter);
router.use(exportRouter);
router.use(reportSchedulesRouter);
router.use(analyticsRouter);
router.use(usageRouter);
router.use((req, res, next) => {
  if (req.path === "/privacy/export") {
    req.url = "/gdpr/export";
  }
  if (req.path === "/privacy/me") {
    req.url = "/gdpr/me";
  }
  next();
});
router.use(gdprRouter);

export default router;
