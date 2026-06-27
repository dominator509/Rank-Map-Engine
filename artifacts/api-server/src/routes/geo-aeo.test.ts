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
  previewGeoAeoPromptCsv: vi.fn(),
  listGeoAeoAnswerSnapshots: vi.fn(),
  createGeoAeoAnswerSnapshot: vi.fn(),
  createGeoAeoSnapshotImportBatch: vi.fn(),
  parseGeoAeoSnapshotCsv: vi.fn(),
  previewGeoAeoSnapshotCsv: vi.fn(),
  listGeoAeoSnapshotImportBatches: vi.fn(),
  rollbackGeoAeoSnapshotImportBatch: vi.fn(),
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
  authorizeGeoAeoClientDashboardAccess: vi.fn(),
  authorizeGeoAeoReportExport: vi.fn(),
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
  serviceMocks.listGeoAeoAudits.mockResolvedValue([
    {
      id: 41,
      auditName: "Filtered Audit",
      clientId: 5,
      projectId: 9,
      status: "in_review",
    },
  ]);
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
  accessMocks.getTenantScopedGeoAeoPrompt.mockResolvedValue({
    id: 1,
    tenantId: 7,
    auditId: 101,
  });
  accessMocks.authorizeGeoAeoReportExport.mockResolvedValue({
    allowed: true,
    permission: "geoAeo.exportReports",
    clientDownload: false,
    licensePlan: null,
  });
  accessMocks.authorizeGeoAeoClientDashboardAccess.mockResolvedValue({
    allowed: true,
    permission: "geoAeo.viewClientDashboard",
    clientView: true,
    downloadsAllowed: true,
    licensePlan: "agency",
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
  serviceMocks.previewGeoAeoPromptCsv.mockResolvedValue({
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    duplicateRows: 0,
    invalid: [],
    duplicates: [],
  });
  serviceMocks.previewGeoAeoSnapshotCsv.mockResolvedValue({
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    duplicateRows: 0,
    invalid: [],
    duplicates: [],
  });
  serviceMocks.parseGeoAeoSnapshotCsv.mockReturnValue({
    errors: [],
    snapshots: [
      {
        auditId: 101,
        promptId: 1,
        engine: "chatgpt",
        captureMethod: "csv_import",
        answerText: "x",
      },
    ],
  });
  serviceMocks.createGeoAeoSnapshotImportBatch.mockResolvedValue({
    batch: { id: 801, auditId: 101, importType: "snapshot_csv", importedRows: 1 },
    snapshots: [{ id: 901, auditId: 101, promptId: 1, importBatchId: 801 }],
  });
  serviceMocks.listGeoAeoSnapshotImportBatches.mockResolvedValue([
    { id: 801, auditId: 101, importType: "snapshot_csv", importedRows: 1, status: "active" },
  ]);
  serviceMocks.rollbackGeoAeoSnapshotImportBatch.mockResolvedValue({
    batch: { id: 801, auditId: 101, status: "rolled_back" },
    rolledBackSnapshots: 1,
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
  it("rejects malformed audit filters and accepts canonical ids", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const invalidAuditId = await fetch(`${baseUrl}/geo-aeo/client/audits/1e2`, {
        headers: { "x-role": "client" },
      });

      expect(invalidAuditId.status).toBe(400);

      const invalid = await fetch(`${baseUrl}/geo-aeo/audits?clientId=1e2`, {
        headers: { "x-role": "agency_admin" },
      });

      expect(invalid.status).toBe(400);
      expect(serviceMocks.listGeoAeoAudits).not.toHaveBeenCalled();

      const valid = await fetch(
        `${baseUrl}/geo-aeo/audits?clientId=5&projectId=9&status=in_review`,
        {
          headers: { "x-role": "agency_admin" },
        },
      );

      expect(valid.status).toBe(200);
      expect(await valid.json()).toEqual([
        {
          id: 41,
          auditName: "Filtered Audit",
          clientId: 5,
          projectId: 9,
          status: "in_review",
        },
      ]);
      expect(serviceMocks.listGeoAeoAudits).toHaveBeenCalledWith({
        tenantId: 7,
        clientId: 5,
        projectId: 9,
        status: "in_review",
      });
    } finally {
      await close();
    }
  });

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
      expect(accessMocks.authorizeGeoAeoClientDashboardAccess).toHaveBeenCalledWith({
        tenantId: 7,
        role: "client",
      });
      expect(serviceMocks.listApprovedGeoAeoClientAudits).toHaveBeenCalledWith({ tenantId: 7 });
    } finally {
      await close();
    }
  }, 15000);

  it("blocks client-dashboard reads when the tenant license does not allow GEO/AEO", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      accessMocks.authorizeGeoAeoClientDashboardAccess.mockResolvedValueOnce({
        allowed: false,
        status: 403,
        error:
          "GEO/AEO client dashboard requires geoAeo.viewClientDashboard and an AI visibility license.",
        permission: "geoAeo.viewClientDashboard",
        licensePlan: "solo",
      });

      const response = await fetch(`${baseUrl}/geo-aeo/client/audits`, {
        headers: { "x-role": "client" },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error:
          "GEO/AEO client dashboard requires geoAeo.viewClientDashboard and an AI visibility license.",
      });
      expect(serviceMocks.listApprovedGeoAeoClientAudits).not.toHaveBeenCalled();
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
        body: JSON.stringify({
          csvText: "promptId,engine,captureMethod,answerText\n1,chatgpt,csv_import,x",
        }),
      });

      expect(response.status).toBe(403);
      expect(serviceMocks.parseGeoAeoSnapshotCsv).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it("previews prompt imports without creating prompts", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/audits/101/prompts/import/preview`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify({ csvText: "promptText\nWho cites us?" }),
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.previewGeoAeoPromptCsv).not.toHaveBeenCalled();

      const preview = await fetch(`${baseUrl}/geo-aeo/audits/101/prompts/import/preview`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify({ csvText: "promptText\nWho cites us?" }),
      });

      expect(preview.status).toBe(200);
      expect(await preview.json()).toEqual({
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        invalid: [],
        duplicates: [],
      });
      expect(serviceMocks.previewGeoAeoPromptCsv).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        csvText: "promptText\nWho cites us?",
      });
      expect(serviceMocks.createGeoAeoPrompts).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it("previews snapshot imports without creating snapshots", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const preview = await fetch(`${baseUrl}/geo-aeo/audits/101/snapshots/import-csv/preview`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify({
          csvText: "promptId,engine,captureMethod,answerText\n1,chatgpt,csv_import,x",
        }),
      });

      expect(preview.status).toBe(200);
      expect(serviceMocks.previewGeoAeoSnapshotCsv).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        csvText: "promptId,engine,captureMethod,answerText\n1,chatgpt,csv_import,x",
      });
      expect(serviceMocks.createGeoAeoSnapshotImportBatch).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it("imports snapshots into a rollbackable batch", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const response = await fetch(`${baseUrl}/geo-aeo/audits/101/snapshots/import-csv`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify({
          csvText: "promptId,engine,captureMethod,answerText\n1,chatgpt,csv_import,x",
        }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        imported: 1,
        batch: { id: 801, auditId: 101, importType: "snapshot_csv", importedRows: 1 },
        snapshots: [{ id: 901, auditId: 101, promptId: 1, importBatchId: 801 }],
      });
      expect(serviceMocks.createGeoAeoSnapshotImportBatch).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
        userId: 11,
        snapshots: [
          {
            auditId: 101,
            promptId: 1,
            engine: "chatgpt",
            captureMethod: "csv_import",
            answerText: "x",
          },
        ],
        preview: {
          totalRows: 1,
          validRows: 1,
          invalidRows: 0,
          duplicateRows: 0,
          invalid: [],
          duplicates: [],
        },
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.snapshot.imported",
          resourceType: "geo_aeo_import_batch",
          resourceId: 801,
        }),
      );
    } finally {
      await close();
    }
  });

  it("lists and rolls back snapshot import batches for operators only", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      const forbidden = await fetch(`${baseUrl}/geo-aeo/snapshot-imports/801`, {
        method: "DELETE",
        headers: { "x-role": "client" },
      });

      expect(forbidden.status).toBe(403);
      expect(serviceMocks.rollbackGeoAeoSnapshotImportBatch).not.toHaveBeenCalled();

      const list = await fetch(`${baseUrl}/geo-aeo/audits/101/snapshot-imports`, {
        headers: { "x-role": "agency_admin" },
      });

      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([
        { id: 801, auditId: 101, importType: "snapshot_csv", importedRows: 1, status: "active" },
      ]);
      expect(serviceMocks.listGeoAeoSnapshotImportBatches).toHaveBeenCalledWith({
        tenantId: 7,
        auditId: 101,
      });

      const rollback = await fetch(`${baseUrl}/geo-aeo/snapshot-imports/801`, {
        method: "DELETE",
        headers: { "x-role": "agency_admin" },
      });

      expect(rollback.status).toBe(200);
      expect(serviceMocks.rollbackGeoAeoSnapshotImportBatch).toHaveBeenCalledWith({
        tenantId: 7,
        importBatchId: 801,
        userId: 11,
      });
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.snapshot_import.rolled_back",
          resourceType: "geo_aeo_import_batch",
          resourceId: 801,
          metadata: { auditId: 101, rolledBackSnapshots: 1 },
        }),
      );
    } finally {
      await close();
    }
  });

  it("rejects duplicate prompt imports using the preview gate", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    serviceMocks.previewGeoAeoPromptCsv.mockResolvedValueOnce({
      totalRows: 1,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 1,
      invalid: [],
      duplicates: [{ row: 2, reason: "Duplicate prompt text already exists in this audit." }],
    });
    try {
      const response = await fetch(`${baseUrl}/geo-aeo/audits/101/prompts/import`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "agency_admin" },
        body: JSON.stringify({ csvText: "promptText\nWho cites us?" }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          error: "Invalid CSV",
          details: ["Row 2: Duplicate prompt text already exists in this audit."],
        }),
      );
      expect(serviceMocks.parseGeoAeoPromptCsv).not.toHaveBeenCalled();
      expect(serviceMocks.createGeoAeoPrompts).not.toHaveBeenCalled();
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

  it("requires report export permission and download license before exporting reports", async () => {
    const { baseUrl, close } = await bootGeoAeoRoute();
    try {
      accessMocks.authorizeGeoAeoReportExport.mockResolvedValueOnce({
        allowed: false,
        status: 403,
        error: "GEO/AEO report export requires geoAeo.exportReports and a report-download license.",
        permission: "geoAeo.exportReports",
        licensePlan: "solo",
      });
      const forbidden = await fetch(`${baseUrl}/geo-aeo/reports/301/export`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify({ format: "markdown" }),
      });

      expect(forbidden.status).toBe(403);
      await expect(forbidden.json()).resolves.toEqual({
        error: "GEO/AEO report export requires geoAeo.exportReports and a report-download license.",
      });
      expect(accessMocks.authorizeGeoAeoReportExport).toHaveBeenCalledWith({
        tenantId: 7,
        reportId: 301,
        role: "client",
      });
      expect(serviceMocks.exportGeoAeoReport).not.toHaveBeenCalled();

      accessMocks.authorizeGeoAeoReportExport.mockResolvedValueOnce({
        allowed: true,
        permission: "geoAeo.exportReports",
        clientDownload: true,
        licensePlan: "agency",
      });
      const clientExported = await fetch(`${baseUrl}/geo-aeo/reports/301/export`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "client" },
        body: JSON.stringify({ format: "markdown" }),
      });

      expect(clientExported.status).toBe(200);
      expect(await clientExported.text()).toBe("# GEO/AEO report");
      expect(accessMocks.auditGeoAeoEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "geo_aeo.report.exported",
          metadata: expect.objectContaining({
            permission: "geoAeo.exportReports",
            clientDownload: true,
            licensePlan: "agency",
          }),
        }),
      );

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
