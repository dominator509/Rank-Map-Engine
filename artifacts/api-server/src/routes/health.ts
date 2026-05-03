import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/detailed", async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    logger.error({ err }, "Health check DB ping failed");
  }

  const aiOk = !!process.env.OPENAI_API_KEY;
  const smtpOk = !!process.env.SMTP_HOST;
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const allOk = dbOk;
  const status = allOk ? "ok" : "degraded";

  res.status(allOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptime),
    responseTimeMs: Date.now() - start,
    services: {
      database: { status: dbOk ? "ok" : "error", latencyMs: dbLatencyMs },
      ai: { status: aiOk ? "configured" : "mock-fallback" },
      smtp: { status: smtpOk ? "configured" : "mock-fallback" },
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    version: process.env.npm_package_version ?? "unknown",
  });
});

export default router;
