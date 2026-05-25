import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

function timingSafeTokenEqual(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function healthTokenMatches(req: Request): boolean {
  const expected = process.env.HEALTH_CHECK_TOKEN?.trim();
  if (!expected) return false;

  const bearer = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actual = req.get("x-health-check-token") ?? bearer;
  return actual ? timingSafeTokenEqual(actual, expected) : false;
}

async function requireDetailedHealthAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (healthTokenMatches(req)) {
    next();
    return;
  }

  await requireAuth(req, res, () => {
    if (req.session.user?.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

router.get("/healthz/detailed", requireDetailedHealthAccess, async (_req, res) => {
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
  const billingEnabled =
    process.env.FEATURE_BILLING === "true" || process.env.FEATURE_STRIPE_BILLING === "true";
  const missingBillingConfig = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_SOLO",
    "STRIPE_PRICE_AGENCY",
    "STRIPE_PRICE_ENTERPRISE",
  ].filter((name) => !process.env[name]);
  const billingOk = !billingEnabled || missingBillingConfig.length === 0;
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const allOk = dbOk && billingOk;
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
      billing: {
        status: billingEnabled ? (billingOk ? "configured" : "missing-config") : "disabled",
        missing: billingEnabled ? missingBillingConfig : [],
      },
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
