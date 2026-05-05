import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, tenantsTable, projectsTable, aiTasksTable } from "@workspace/db";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const FEATURE_BILLING = process.env.FEATURE_BILLING === "true";

const PLANS = [
  {
    id: "solo",
    name: "solo" as const,
    displayName: "Solo",
    priceMonthly: 29,
    seats: 1,
    projectsMax: 3,
    aiTasksPerMonth: 50,
    whiteLabelEnabled: false,
  },
  {
    id: "agency",
    name: "agency" as const,
    displayName: "Agency",
    priceMonthly: 99,
    seats: 5,
    projectsMax: 25,
    aiTasksPerMonth: 500,
    whiteLabelEnabled: true,
  },
  {
    id: "enterprise",
    name: "enterprise" as const,
    displayName: "Enterprise",
    priceMonthly: 299,
    seats: 25,
    projectsMax: 9999,
    aiTasksPerMonth: 9999,
    whiteLabelEnabled: true,
  },
];

router.get("/billing/plans", async (_req, res): Promise<void> => {
  res.json(PLANS);
});

router.get("/billing/subscription", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  res.json({
    plan: tenant.plan,
    status: "active",
    seatsUsed: tenant.seatsUsed,
    seatsMax: tenant.seatsMax,
    currentPeriodEnd: null,
    stripeSubscriptionId: tenant.stripeSubscriptionId,
    cancelAtPeriodEnd: false,
  });
});

router.post(
  "/billing/checkout",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    if (!FEATURE_BILLING) {
      res.status(501).json({ error: "Billing not enabled" });
      return;
    }

    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    res.json({ url: "https://checkout.stripe.com/mock" });
  },
);

router.post(
  "/billing/portal",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    if (!FEATURE_BILLING) {
      res.status(501).json({ error: "Billing not enabled" });
      return;
    }

    res.json({ url: "https://billing.stripe.com/mock" });
  },
);

router.get("/billing/usage", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [aiTasksThisMonth, projectCount] = await Promise.all([
    db
      .select({ id: aiTasksTable.id })
      .from(aiTasksTable)
      .where(and(eq(aiTasksTable.tenantId, tenantId), gte(aiTasksTable.createdAt, startOfMonth)))
      .then((rows) => rows.length),
    db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.tenantId, tenantId))
      .then((rows) => rows.length),
  ]);

  const plan = PLANS.find((p) => p.id === tenant.plan) ?? PLANS[0];

  res.json({
    aiTasksThisMonth,
    aiTasksLimit: plan.aiTasksPerMonth,
    seatsUsed: tenant.seatsUsed,
    seatsMax: tenant.seatsMax,
    projectsCount: projectCount,
    projectsMax: plan.projectsMax,
  });
});

export default router;
