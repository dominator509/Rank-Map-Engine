import express, { type Router } from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  listGeoAeoAudits: vi.fn(),
  createGeoAeoAudit: vi.fn(),
  listApprovedGeoAeoClientAudits: vi.fn(),
  getApprovedGeoAeoClientAuditDetail: vi.fn(),
  listGeoAeoPrompts: vi.fn(),
  createGeoAeoPrompt: vi.fn(),
  createGeoAeoPrompts: vi.fn(),
  parseGeoAeoPromptCsv: vi.fn(),
  listGeoAeoAnswerSnapshots: vi.fn(),
  createGeoAeoAnswerSnapshot: vi.fn(),
  createGeoAeoAnswerSnapshots: vi.fn(),
  parseGeoAeoSnapshotCsv: vi.fn(),
  updateGeoAeoAnswerSnapshot: vi.fn(),
  listGeoAeoCompetitors: vi.fn(),
  createGeoAeoCompetitor: vi.fn(),
  updateGeoAeoCompetitor: vi.fn(),
  listGeoAeoCitations: vi.fn(),
  createGeoAeoCitation: vi.fn(),
  softDeleteGeoAeoCitation: vi.fn(),
  softDeleteGeoAeoCompetitor: vi.fn(),
  listGeoAeoSourceRecommendations: vi.fn(),
  createGeoAeoSourceRecommendation: vi.fn(),
  updateGeoAeoSourceRecommendation: vi.fn(),
  softDeleteGeoAeoSourceRecommendation: vi.fn(),
  listGeoAeoSchemaFindings: vi.fn(),
  createGeoAeoSchemaFinding: vi.fn(),
  updateGeoAeoSchemaFinding: vi.fn(),
  softDeleteGeoAeoSchemaFinding: vi.fn(),
  listGeoAeoMonitoringRuns: vi.fn(),
  listApprovedGeoAeoMonitoringRuns: vi.fn(),
  createGeoAeoMonitoringRun: vi.fn(),
  updateGeoAeoMonitoringRun: vi.fn(),
  analyzeGeoAeoAudit: vi.fn(),
  calculateAndStoreGeoAeoScore: vi.fn(),
  listGeoAeoFindings: vi.fn(),
  updateGeoAeoFinding: vi.fn(),
  generateGeoAeoActionPlan: vi.fn(),
  getGeoAeoActionPlan: vi.fn(),
  createGeoAeoActionItem: vi.fn(),
  updateGeoAeoActionItem: vi.fn(),
  softDeleteGeoAeoActionItem: vi.fn(),
  generateGeoAeoReport: vi.fn(),
  exportGeoAeoReport: vi.fn(),
  updateGeoAeoAudit: vi.fn(),
  softDeleteGeoAeoAudit: vi.fn(),
}));

const accessMocks = vi.hoisted(() => ({
  assertTenantScopedClient: vi.fn(),
  assertTenantScopedProject: vi.fn(),
  auditGeoAeoEvent: vi.fn(),
  getTenantScopedGeoAeoAudit: vi.fn(),
  getTenantScopedGeoAeoPrompt: vi.fn(),
  getTenantScopedGeoAeoFinding: vi.fn(),
}));

vi.mock("../lib/geo-aeo-service.js", () => serviceMocks);

vi.mock("../lib/geo-aeo-access.js", () => ({
  ...accessMocks,
  GEO_AEO_VIEW_ROLES: ["agency_admin", "agency_user", "client", "super_admin"],
  GEO_AEO_OPERATOR_ROLES: ["agency_admin", "agency_user", "super_admin"],
  GEO_AEO_APPROVER_ROLES: ["agency_admin", "super_admin"],
}));

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.session = {
      user: {
        id: Number(req.get("x-user-id") ?? 11),
        tenantId: Number(req.get("x-tenant-id") ?? 7),
        email: "geo-aeo@example.test",
        fullName: "Geo Aeo Tester",
        role: req.get("x-role") ?? "agency_admin",
      },
    };
    next();
  },
  requireRole: (roles: string[]) => (req: any, res: any, next: () => void) => {
    const user = req.session?.user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  },
}));

async function bootGeoAeoRoute(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const imported = await import("./geo-aeo.js");
  const router = imported.default as Router;
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, () => resolve(listener));
    listener.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listApprovedGeoAeoClientAudits.mockResolvedValue([
    { id: 101, auditName: "Approved Audit", status: "approved" },
  ]);
  serviceMocks.getApprovedGeoAeoClientAuditDetail.mockResolvedValue({
    audit: { id: 101, auditName: "Approved Audit", status: "approved" },
    findings: [{ id: 201, status: "approved", title: "Approved finding" }],
    actionPlan: null,
    reports: [{ id: 301, type: "geo_aeo_visibility_audit", format: "markdown" }],
  });
  accessMocks.getTenantScopedGeoAeoAudit.mockResolvedValue({
    id: 101,
    tenantId: 7,
    clientId: 5,
    projectId: 9,
    status: "in_review",
    approvedAt: null,
  });
  serviceMocks.updateGeoAeoAudit.mockResolvedValue({
    id: 101,
    tenantId: 7,
    status: "approved",
    approvedAt: new Date("2026-06-24T00:00:00Z"),
  });
  serviceMocks.exportGeoAeoReport.mockResolvedValue({
    body: "# GEO/AEO report",
    filename: "geo-aeo-report-301.md",
    contentType: "text/markdown",
    report: { id: 301 },
  });
  serviceMocks.createGeoAeoCitation.mockResolvedValue({
    id: 401,
    auditId: 101,
    sourceName: "Manual source",
    url: "https://example.test/source",
  });
  serviceMocks.listApprovedGeoAeoMonitoringRuns.mockResolvedValue([
    { id: 501, auditId: 101, runMonth: "2026-06", status: "approved", scoreDelta: 4 },
  ]);
  serviceMocks.createGeoAeoMonitoringRun.mockResolvedValue({
    id: 502,
    auditId: 101,
    runMonth: "2026-07",
    status: "draft",
    scoreDelta: 3,
  });
  serviceMocks.updateGeoAeoMonitoringRun.mockResolvedValue({
    id: 502,
    auditId: 101,
    runMonth: "2026-07",
    status: "approved",
    scoreDelta: 3,
  });
  serviceMocks.createGeoAeoActionItem.mockResolvedValue({
    plan: { id: 601, auditId: 101, status: "draft" },
    item: { id: 602, auditId: 101, title: "Manual action item", status: "draft" },
  });
  serviceMocks.softDeleteGeoAeoCompetitor.mockResolvedValue({ id: 701, auditId: 101 });
  serviceMocks.softDeleteGeoAeoSourceRecommendation.mockResolvedValue({ id: 702, auditId: 101 });
  serviceMocks.softDeleteGeoAeoSchemaFinding.mockResolvedValue({ id: 703, auditId: 101 });
  serviceMocks.softDeleteGeoAeoActionItem.mockResolvedValue({ id: 704, auditId: 101 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GEO/AEO route security and approval boundaries", () => {
  it("returns only the approved client-dashboard feed for client-role viewers", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const response = await fetch(`${baseUrl}/geo-aeo/client/audits`, {
        headers: { "x-role": "client" },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        { id: 101, auditName: "Approved Audit", status: "approved" },
      ]);
      expect(serviceMocks.listApprovedGeoAeoClientAudits).toHaveBeenCalledWith({ tenantId: 7 });
    } finally {
      await close();
    }
  });

  it("blocks client-role users from importing snapshots", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const response = await fetch(`${baseUrl}/geo-aeo/audits/101/snapshots/import-csv`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify({ csvText: "promptId,engine,captureMethod,answerText\n1,chatgpt,csv_import,x" }),
      });

      expect(response.status).toBe(403);
      expect(serviceMocks.parseGeoAeoSnapshotCsv).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it("requires approver roles for the explicit audit approval endpoint", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/audits/101/approve`, {
        method: "POST",
        headers: { "x-role": "agency_user" },
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.updateGeoAeoAudit).not.toHaveBeenCalled();

      const approved = await fetch(`${baseUrl}/geo-aeo/audits/101/approve`, {
        method: "POST",
        headers: { "x-role": "agency_admin" },
      });

      expect(approved.status).toBe(200);
      expect(serviceMocks.updateGeoAeoAudit).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        userId: 11,
        input: { status: "approved" },
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.audit.approved",
          resourceType: "geo_aeo_audit",
          resourceId: 101,
        }),
      );
    } finally {
      await close();
    }
  });

  it("blocks client-role report export and returns operator exports with attachment headers", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/reports/301/export`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify({ format: "markdown" }),
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.exportGeoAeoReport).not.toHaveBeenCalled();

      const exported = await fetch(`${baseUrl}/geo-aeo/reports/301/export`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify({ format: "markdown" }),
      });

      expect(exported.status).toBe(200);
      expect(exported.headers.get("content-type")).toContain("text/markdown");
      expect(exported.headers.get("content-disposition")).toBe(
        'attachment; filename="geo-aeo-report-301.md"',
      );
      expect(await exported.text()).toBe("# GEO/AEO report");
    } finally {
      await close();
    }
  });

  it("blocks client-role citation edits and audits operator-created citations", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    const body = {
      sourceName: "Manual source",
      url: "https://example.test/source",
      isClientOwned: true,
    };

    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/audits/101/citations`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify(body),
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.createGeoAeoCitation).not.toHaveBeenCalled();

      const created = await fetch(`${baseUrl}/geo-aeo/audits/101/citations`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify(body),
      });

      expect(created.status).toBe(201);
      expect(serviceMocks.createGeoAeoCitation).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        userId: 11,
        input: expect.objectContaining({ sourceName: "Manual source", isClientOwned: true }),
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.citation.created",
          resourceType: "geo_aeo_citation",
          resourceId: 401,
        }),
      );
    } finally {
      await close();
    }
  });

  it("lets client-role viewers read approved monitoring progress only", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const response = await fetch(`${baseUrl}/geo-aeo/client/audits/101/monitoring-runs`, {
        headers: { "x-role": "client" },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        { id: 501, auditId: 101, runMonth: "2026-06", status: "approved", scoreDelta: 4 },
      ]);
      expect(serviceMocks.listApprovedGeoAeoMonitoringRuns).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
      });
    } finally {
      await close();
    }
  });

  it("blocks clients from creating monitoring runs and audits operator-created runs", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    const body = {
      runMonth: "2026-07",
      baselineMonth: "2026-06",
      baselineScore: 70,
      currentScore: 73,
      currentSnapshotCount: 12,
    };

    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/audits/101/monitoring-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify(body),
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.createGeoAeoMonitoringRun).not.toHaveBeenCalled();

      const created = await fetch(`${baseUrl}/geo-aeo/audits/101/monitoring-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify(body),
      });

      expect(created.status).toBe(201);
      expect(serviceMocks.createGeoAeoMonitoringRun).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        userId: 11,
        input: expect.objectContaining({ runMonth: "2026-07", baselineScore: 70 }),
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.monitoring_run.created",
          resourceType: "geo_aeo_monitoring_run",
          resourceId: 502,
        }),
      );
    } finally {
      await close();
    }
  });

  it("requires approver roles for monitoring run approval", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/monitoring-runs/502/approve`, {
        method: "POST",
        headers: { "x-role": "agency_user" },
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.updateGeoAeoMonitoringRun).not.toHaveBeenCalled();

      const approved = await fetch(`${baseUrl}/geo-aeo/monitoring-runs/502/approve`, {
        method: "POST",
        headers: { "x-role": "agency_admin" },
      });

      expect(approved.status).toBe(200);
      expect(serviceMocks.updateGeoAeoMonitoringRun).toHaveBeenCalledWith({
        tenantId: 7,
        monitoringRunId: 502,
        userId: 11,
        input: { status: "approved" },
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.monitoring_run.approved",
          resourceType: "geo_aeo_monitoring_run",
          resourceId: 502,
        }),
      );
    } finally {
      await close();
    }
  });

  it("blocks clients from creating manual action items and audits operator-created items", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    const body = {
      title: "Create AI-citable FAQ section",
      description: "Write direct answers for source-worthy service questions.",
      category: "faq_schema",
      priority: "high",
      weekNumber: 2,
    };

    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/audits/101/action-items`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify(body),
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.createGeoAeoActionItem).not.toHaveBeenCalled();

      const created = await fetch(`${baseUrl}/geo-aeo/audits/101/action-items`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify(body),
      });

      expect(created.status).toBe(201);
      expect(serviceMocks.createGeoAeoActionItem).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        userId: 11,
        input: expect.objectContaining({
          title: "Create AI-citable FAQ section",
          category: "faq_schema",
          priority: "high",
          weekNumber: 2,
          status: "draft",
        }),
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.action_item.created",
          resourceType: "geo_aeo_action_item",
          resourceId: 602,
        }),
      );
    } finally {
      await close();
    }
  });

  it("blocks clients from deleting manual records and audits operator soft deletes", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/competitors/701`, {
        method: "DELETE",
        headers: { "x-role": "client" },
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.softDeleteGeoAeoCompetitor).not.toHaveBeenCalled();

      const deletions = await Promise.all([
        fetch(`${baseUrl}/geo-aeo/competitors/701`, { method: "DELETE" }),
        fetch(`${baseUrl}/geo-aeo/source-recommendations/702`, { method: "DELETE" }),
        fetch(`${baseUrl}/geo-aeo/schema-findings/703`, { method: "DELETE" }),
        fetch(`${baseUrl}/geo-aeo/action-items/704`, { method: "DELETE" }),
      ]);

      expect(deletions.map((response) => response.status)).toEqual([204, 204, 204, 204]);
      expect(serviceMocks.softDeleteGeoAeoCompetitor).toHaveBeenCalledWith({
        tenantId: 7,
        competitorId: 701,
        userId: 11,
      });
      expect(serviceMocks.softDeleteGeoAeoSourceRecommendation).toHaveBeenCalledWith({
        tenantId: 7,
        sourceRecommendationId: 702,
        userId: 11,
      });
      expect(serviceMocks.softDeleteGeoAeoSchemaFinding).toHaveBeenCalledWith({
        tenantId: 7,
        schemaFindingId: 703,
        userId: 11,
      });
      expect(serviceMocks.softDeleteGeoAeoActionItem).toHaveBeenCalledWith({
        tenantId: 7,
        actionItemId: 704,
        userId: 11,
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.competitor.deleted",
          resourceType: "geo_aeo_competitor",
          resourceId: 701,
        }),
      );
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.action_item.deleted",
          resourceType: "geo_aeo_action_item",
          resourceId: 704,
        }),
      );
    } finally {
      await close();
    }
  });
});
