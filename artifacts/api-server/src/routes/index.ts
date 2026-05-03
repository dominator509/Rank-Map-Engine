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

export default router;
