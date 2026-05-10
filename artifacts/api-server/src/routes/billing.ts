import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, tenantsTable, projectsTable, aiTasksTable } from "@workspace/db";
import {
  CreateBillingPortalResponse,
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

const FEATURE_BILLING =
  process.env.FEATURE_BILLING === "true" || process.env.FEATURE_STRIPE_BILLING === "true";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 15000;
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const STRIPE_PRICE_ENV_BY_PLAN: Record<string, string> = {
  solo: "STRIPE_PRICE_SOLO",
  agency: "STRIPE_PRICE_AGENCY",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

type Tenant = typeof tenantsTable.$inferSelect;
type SessionUser = NonNullable<Request["session"]["user"]>;

interface StripeCustomerResponse {
  id?: string;
}

interface StripeUrlResponse {
  url?: string | null;
}

interface StripeErrorResponse {
  error?: {
    message?: string;
  };
}

interface StripeEvent<T = Record<string, unknown>> {
  id?: string;
  type?: string;
  data?: {
    object?: T;
  };
}

interface StripeCheckoutSession {
  object?: "checkout.session";
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string | undefined> | null;
}

interface StripeSubscription {
  object?: "subscription";
  id?: string;
  customer?: string | { id?: string } | null;
  status?: string;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string | undefined> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
}

interface StripeInvoice {
  object?: "invoice";
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
}

class BillingConfigError extends Error {}

class StripeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new BillingConfigError("Stripe is not configured.");
  }
  return key;
}

function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new BillingConfigError("Stripe webhook secret is not configured.");
  }
  return secret;
}

function assertBillingConfiguredForSubscriptionChanges(planId?: string): void {
  getStripeSecretKey();
  getStripeWebhookSecret();
  if (planId) {
    getStripePriceId(planId);
  }
}

function getStripePriceId(planId: string): string {
  const envName = STRIPE_PRICE_ENV_BY_PLAN[planId];
  const priceId = envName ? process.env[envName] : undefined;
  if (!priceId) {
    throw new BillingConfigError(`Stripe price is not configured for the ${planId} plan.`);
  }
  return priceId;
}

function getPlanById(planId: string | undefined) {
  return PLANS.find((p) => p.id === planId);
}

function getPlanIdFromPriceId(priceId: string | undefined): string | undefined {
  if (!priceId) return undefined;

  for (const [planId, envName] of Object.entries(STRIPE_PRICE_ENV_BY_PLAN)) {
    if (process.env[envName] === priceId) {
      return planId;
    }
  }

  return undefined;
}

function getAppBaseUrl(req: Request): string {
  const configuredUrl = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
  const fallbackUrl = req.get("origin") ?? `${req.protocol}://${req.get("host")}`;
  return (configuredUrl ?? fallbackUrl).replace(/\/+$/, "");
}

async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const resp = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  });

  const text = await resp.text();
  const data = text ? (JSON.parse(text) as StripeErrorResponse | T) : ({} as T);

  if (!resp.ok) {
    const stripeMessage = (data as StripeErrorResponse).error?.message ?? "Stripe request failed";
    throw new StripeRequestError(stripeMessage, resp.status);
  }

  return data as T;
}

async function ensureStripeCustomer(tenant: Tenant, user: SessionUser): Promise<string> {
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const body = new URLSearchParams({
    email: user.email,
    name: tenant.name,
    "metadata[tenantId]": String(tenant.id),
    "metadata[userId]": String(user.id),
  });

  const customer = await stripeRequest<StripeCustomerResponse>("/customers", body);
  if (!customer.id) {
    throw new StripeRequestError("Stripe did not return a customer id.", 502);
  }

  await db
    .update(tenantsTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(tenantsTable.id, tenant.id));

  return customer.id;
}

function toStripeId(value: string | { id?: string } | null | undefined): string | undefined {
  if (typeof value === "string") return value;
  return value?.id;
}

function tenantIdFromStripeMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
  fallback: string | null | undefined,
): number | undefined {
  const parsed = Number(metadata?.tenantId ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function dateFromStripeTimestamp(timestamp: number | null | undefined): Date | null {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp * 1000);
}

function stripeStatusForTenant(tenant: Tenant): string {
  if (tenant.stripeSubscriptionStatus) {
    return tenant.stripeSubscriptionStatus;
  }
  return tenant.stripeSubscriptionId ? "unknown" : "inactive";
}

async function findTenantForStripeObject(params: {
  tenantId?: number;
  customerId?: string;
  subscriptionId?: string;
}): Promise<Tenant | undefined> {
  if (params.tenantId) {
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, params.tenantId))
      .limit(1);
    if (tenant) return tenant;
  }

  if (params.subscriptionId) {
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.stripeSubscriptionId, params.subscriptionId))
      .limit(1);
    if (tenant) return tenant;
  }

  if (params.customerId) {
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.stripeCustomerId, params.customerId))
      .limit(1);
    if (tenant) return tenant;
  }

  return undefined;
}

async function applyTenantPlan(
  tenantId: number,
  planId: string,
  updates: Partial<Tenant>,
): Promise<void> {
  const plan = getPlanById(planId);
  if (!plan) {
    throw new Error(`Unknown Stripe plan id: ${planId}`);
  }

  await db
    .update(tenantsTable)
    .set({
      ...updates,
      plan: plan.id,
      seatsMax: plan.seats,
    })
    .where(eq(tenantsTable.id, tenantId));
}

async function downgradeTenantToSolo(
  tenantId: number,
  updates: Partial<Tenant> = {},
): Promise<void> {
  await applyTenantPlan(tenantId, "solo", {
    ...updates,
    stripeSubscriptionId: null,
    stripeCurrentPeriodEnd: null,
    stripeCancelAtPeriodEnd: false,
  });
}

async function handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
  const customerId = toStripeId(session.customer);
  const subscriptionId = toStripeId(session.subscription);
  const tenantId = tenantIdFromStripeMetadata(session.metadata, session.client_reference_id);
  const planId = session.metadata?.planId;

  if (!planId || !getPlanById(planId)) {
    throw new Error("Stripe checkout session is missing a known plan id.");
  }

  const tenant = await findTenantForStripeObject({ tenantId, customerId, subscriptionId });
  if (!tenant) {
    throw new Error("Stripe checkout session did not match a tenant.");
  }

  await applyTenantPlan(tenant.id, planId, {
    stripeCustomerId: customerId ?? tenant.stripeCustomerId,
    stripeSubscriptionId: subscriptionId ?? tenant.stripeSubscriptionId,
    stripeSubscriptionStatus: "active",
    stripeCancelAtPeriodEnd: false,
  });
}

async function handleSubscriptionUpdated(subscription: StripeSubscription): Promise<void> {
  const customerId = toStripeId(subscription.customer);
  const subscriptionId = subscription.id;
  const tenantId = tenantIdFromStripeMetadata(subscription.metadata, undefined);
  const planId =
    subscription.metadata?.planId ?? getPlanIdFromPriceId(subscription.items?.data?.[0]?.price?.id);

  const tenant = await findTenantForStripeObject({ tenantId, customerId, subscriptionId });
  if (!tenant) {
    throw new Error("Stripe subscription did not match a tenant.");
  }

  if (["active", "trialing", "past_due"].includes(subscription.status ?? "")) {
    if (!planId || !getPlanById(planId)) {
      throw new Error("Stripe subscription is missing a known plan id.");
    }

    await applyTenantPlan(tenant.id, planId, {
      stripeCustomerId: customerId ?? tenant.stripeCustomerId,
      stripeSubscriptionId: subscriptionId ?? tenant.stripeSubscriptionId,
      stripeSubscriptionStatus: subscription.status ?? tenant.stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: dateFromStripeTimestamp(subscription.current_period_end),
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });
    return;
  }

  if (["canceled", "incomplete_expired", "unpaid"].includes(subscription.status ?? "")) {
    await downgradeTenantToSolo(tenant.id, {
      stripeCustomerId: customerId ?? tenant.stripeCustomerId,
      stripeSubscriptionStatus: subscription.status ?? tenant.stripeSubscriptionStatus,
    });
  }
}

async function handleInvoicePaymentFailed(invoice: StripeInvoice): Promise<void> {
  const customerId = toStripeId(invoice.customer);
  const subscriptionId = toStripeId(invoice.subscription);
  const tenant = await findTenantForStripeObject({ customerId, subscriptionId });

  if (!tenant) {
    throw new Error("Stripe invoice did not match a tenant.");
  }

  await db
    .update(tenantsTable)
    .set({ stripeSubscriptionStatus: "past_due" })
    .where(eq(tenantsTable.id, tenant.id));
}

function getStripeEvent(req: Request): StripeEvent {
  const payload = req.body;
  const signature = req.get("stripe-signature");

  if (!Buffer.isBuffer(payload)) {
    throw new Error("Stripe webhook payload must be raw bytes.");
  }

  verifyStripeSignature(payload, signature, getStripeWebhookSecret());
  return JSON.parse(payload.toString("utf8")) as StripeEvent;
}

function verifyStripeSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): void {
  if (!signatureHeader) {
    throw new Error("Missing Stripe signature header.");
  }

  const signatureParts = signatureHeader
    .split(",")
    .reduce<Record<string, string[]>>((parts, item) => {
      const [key, value] = item.split("=");
      if (!key || !value) return parts;
      parts[key] = [...(parts[key] ?? []), value];
      return parts;
    }, {});

  const timestamp = Number(signatureParts.t?.[0]);
  const signatures = signatureParts.v1 ?? [];

  if (!Number.isInteger(timestamp) || signatures.length === 0) {
    throw new Error("Malformed Stripe signature header.");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Expired Stripe signature.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest("hex");

  const expectedBytes = Buffer.from(expected, "hex");
  const isValid = signatures.some((signature) => {
    const receivedBytes = Buffer.from(signature, "hex");
    return (
      receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
    );
  });

  if (!isValid) {
    throw new Error("Invalid Stripe signature.");
  }
}

function handleStripeError(res: Response, err: unknown): void {
  if (err instanceof BillingConfigError) {
    res.status(503).json({ error: err.message });
    return;
  }

  if (err instanceof StripeRequestError) {
    logger.error({ err, status: err.status }, "Stripe API request failed");
    res.status(502).json({ error: "Stripe request failed." });
    return;
  }

  logger.error({ err }, "Unexpected billing error");
  res.status(500).json({ error: "Billing request failed." });
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const event = getStripeEvent(req);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data?.object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionUpdated(event.data?.object as StripeSubscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data?.object as StripeInvoice);
        logger.warn({ eventId: event.id }, "Stripe invoice payment failed");
        break;
      default:
        logger.debug({ eventType: event.type }, "Ignored Stripe webhook event");
        break;
    }

    res.json({ received: true });
  } catch (err) {
    logger.warn({ err }, "Rejected Stripe webhook");
    res.status(400).json({ error: "Invalid Stripe webhook." });
  }
}

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
    status: stripeStatusForTenant(tenant),
    seatsUsed: tenant.seatsUsed,
    seatsMax: tenant.seatsMax,
    currentPeriodEnd: tenant.stripeCurrentPeriodEnd?.toISOString() ?? null,
    stripeSubscriptionId: tenant.stripeSubscriptionId,
    cancelAtPeriodEnd: tenant.stripeCancelAtPeriodEnd,
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

    const plan = PLANS.find((p) => p.id === parsed.data.planId);
    if (!plan) {
      res.status(400).json({ error: "Unknown billing plan." });
      return;
    }

    try {
      assertBillingConfiguredForSubscriptionChanges(plan.id);

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

      const priceId = getStripePriceId(plan.id);
      const customerId = await ensureStripeCustomer(tenant, req.session.user!);
      const appBaseUrl = getAppBaseUrl(req);

      const session = await stripeRequest<StripeUrlResponse>(
        "/checkout/sessions",
        new URLSearchParams({
          mode: "subscription",
          customer: customerId,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: `${appBaseUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appBaseUrl}/billing?checkout=cancelled`,
          client_reference_id: String(tenant.id),
          allow_promotion_codes: "true",
          "metadata[tenantId]": String(tenant.id),
          "metadata[planId]": plan.id,
          "subscription_data[metadata][tenantId]": String(tenant.id),
          "subscription_data[metadata][planId]": plan.id,
        }),
      );

      if (!session.url) {
        throw new StripeRequestError("Stripe did not return a checkout URL.", 502);
      }

      res.json(CreateCheckoutSessionResponse.parse({ url: session.url }));
    } catch (err) {
      handleStripeError(res, err);
    }
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

    try {
      assertBillingConfiguredForSubscriptionChanges();

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

      const customerId = await ensureStripeCustomer(tenant, req.session.user!);
      const portalSession = await stripeRequest<StripeUrlResponse>(
        "/billing_portal/sessions",
        new URLSearchParams({
          customer: customerId,
          return_url: `${getAppBaseUrl(req)}/billing`,
        }),
      );

      if (!portalSession.url) {
        throw new StripeRequestError("Stripe did not return a billing portal URL.", 502);
      }

      res.json(CreateBillingPortalResponse.parse({ url: portalSession.url }));
    } catch (err) {
      handleStripeError(res, err);
    }
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
