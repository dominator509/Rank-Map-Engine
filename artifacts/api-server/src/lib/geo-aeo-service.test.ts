import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  updateSet: undefined as Record<string, unknown> | undefined,
  updateReturningRows: [] as unknown[][],
  insertValues: undefined as Record<string, unknown> | undefined,
  insertReturningRows: [] as unknown[][],
  selectRows: [] as unknown[][],
}));

function tableMock() {
  return new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  );
}

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  desc: (value: unknown) => ({ op: "desc", value }),
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  inArray: (...args: unknown[]) => ({ op: "inArray", args }),
  isNull: (value: unknown) => ({ op: "isNull", value }),
}));

vi.mock("@workspace/db", () => {
  const chainSelect = () => {
    const rows = dbState.selectRows.shift() ?? [];
    const promise = Promise.resolve(rows);
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => promise,
      then: (...args: Parameters<typeof promise.then>) => promise.then(...args),
      catch: (...args: Parameters<typeof promise.catch>) => promise.catch(...args),
    };
    return chain;
  };

  return {
    db: {
      select: vi.fn(chainSelect),
      update: vi.fn(() => ({
        set: vi.fn((updates: Record<string, unknown>) => {
          dbState.updateSet = updates;
          return {
            where: vi.fn(() => ({
              returning: vi.fn(async () => dbState.updateReturningRows.shift() ?? []),
            })),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          dbState.insertValues = values;
          return {
            returning: vi.fn(async () => dbState.insertReturningRows.shift() ?? []),
          };
        }),
      })),
    },
    geoAeoActionItemsTable: tableMock(),
    geoAeoActionPlansTable: tableMock(),
    geoAeoAnswerSnapshotsTable: tableMock(),
    geoAeoAuditsTable: tableMock(),
    geoAeoCitationsTable: tableMock(),
    geoAeoCompetitorsTable: tableMock(),
    geoAeoEnginesTable: tableMock(),
    geoAeoFindingsTable: tableMock(),
    geoAeoMentionsTable: tableMock(),
    geoAeoMonitoringRunsTable: tableMock(),
    geoAeoPromptsTable: tableMock(),
    geoAeoSchemaFindingsTable: tableMock(),
    geoAeoSourceRecommendationsTable: tableMock(),
    geoAeoVisibilityScoresTable: tableMock(),
    reportsTable: tableMock(),
  };
});

describe("GEO/AEO service hardening", () => {
  beforeEach(() => {
    dbState.updateSet = undefined;
    dbState.updateReturningRows = [];
    dbState.insertValues = undefined;
    dbState.insertReturningRows = [];
    dbState.selectRows = [];
  });

  it("stores audit approval metadata when approving an audit", async () => {
    const { updateGeoAeoAudit } = await import("./geo-aeo-service.js");
    const approvedAtBeforeCall = Date.now();
    dbState.updateReturningRows.push([{ id: 44, status: "approved" }]);

    const audit = await updateGeoAeoAudit({
      tenantId: 7,
      auditId: 44,
      userId: 12,
      input: { status: "approved" },
    });

    expect(audit).toEqual({ id: 44, status: "approved" });
    expect(dbState.updateSet).toMatchObject({
      status: "approved",
      approvedById: 12,
      updatedById: 12,
    });
    expect(dbState.updateSet?.approvedAt).toBeInstanceOf(Date);
    expect((dbState.updateSet?.approvedAt as Date).getTime()).toBeGreaterThanOrEqual(
      approvedAtBeforeCall,
    );
  });

  it("neutralizes spreadsheet formulas when exporting stored report data as CSV", async () => {
    const { exportGeoAeoReport } = await import("./geo-aeo-service.js");
    dbState.selectRows.push([
      {
        id: 55,
        data: {
          generatedAt: "2026-06-24T00:00:00.000Z",
          audit: {
            id: 44,
            name: "Dangerous Audit",
            websiteUrl: "https://example.test",
            niche: "Local services",
            projectId: 9,
            visibilityScore: 75,
            visibilityLabel: "=HYPERLINK(\"https://attacker.test\")",
          },
          summary: {
            promptCount: 1,
            snapshotCount: 1,
            findingCount: 1,
            actionItemCount: 1,
          },
          findings: [
            {
              id: 1,
              title: "+SUM(1,2)",
              status: "approved",
              recommendation: "@IMPORTXML(\"https://attacker.test\")",
            },
          ],
          actionPlan: {
            plan: { id: 1, name: "Plan", status: "draft" },
            items: [
              {
                id: 1,
                title: "-CMD",
                status: "approved",
                weekNumber: 1,
                description: "=2+2",
              },
            ],
          },
        },
      },
    ]);

    const exported = await exportGeoAeoReport({
      tenantId: 7,
      reportId: 55,
      format: "csv",
    });

    expect(exported?.contentType).toBe("text/csv");
    expect(exported?.body).toContain("'=HYPERLINK");
    expect(exported?.body).toContain("'+SUM(1,2)");
    expect(exported?.body).toContain("'@IMPORTXML");
    expect(exported?.body).toContain("'-CMD");
    expect(exported?.body).not.toContain("\n=2+2");
  });

  it("exports stored report data as a PDF document", async () => {
    const { exportGeoAeoReport } = await import("./geo-aeo-service.js");
    dbState.selectRows.push([
      {
        id: 56,
        data: {
          generatedAt: "2026-06-24T00:00:00.000Z",
          audit: {
            id: 44,
            name: "PDF Audit",
            websiteUrl: "https://example.test",
            niche: "Local services",
            projectId: 9,
            visibilityScore: 82,
            visibilityLabel: "Strong AI Presence",
          },
          summary: {
            promptCount: 2,
            snapshotCount: 3,
            findingCount: 1,
            actionItemCount: 1,
          },
          findings: [
            {
              id: 1,
              title: "Brand is cited inconsistently",
              severity: "medium",
              status: "approved",
              recommendation: "Strengthen source pages.",
            },
          ],
          actionPlan: null,
        },
      },
    ]);

    const exported = await exportGeoAeoReport({
      tenantId: 7,
      reportId: 56,
      format: "pdf",
    });

    expect(exported?.contentType).toBe("application/pdf");
    expect(exported?.filename).toBe("geo-aeo-report-56.pdf");
    expect(exported?.body.startsWith("%PDF-1.4")).toBe(true);
    expect(exported?.body).toContain("PDF Audit GEO/AEO Visibility Audit");
    expect(exported?.body).toContain("%%EOF");
  });

  it("stores month-over-month score deltas for manual monitoring runs", async () => {
    const { createGeoAeoMonitoringRun } = await import("./geo-aeo-service.js");
    dbState.insertReturningRows.push([
      { id: 77, runMonth: "2026-07", baselineScore: 70, currentScore: 73.25, scoreDelta: 3.25 },
    ]);

    const run = await createGeoAeoMonitoringRun({
      tenantId: 7,
      auditId: 44,
      userId: 12,
      input: {
        runMonth: "2026-07",
        baselineMonth: "2026-06",
        comparisonMonth: "2026-07",
        baselineScore: 70,
        currentScore: 73.25,
        baselineSnapshotCount: 10,
        currentSnapshotCount: 12,
        actionPlanTemplate: {},
        reportTemplate: {},
      },
    });

    expect(run).toEqual({
      id: 77,
      runMonth: "2026-07",
      baselineScore: 70,
      currentScore: 73.25,
      scoreDelta: 3.25,
    });
    expect(dbState.insertValues).toMatchObject({
      tenantId: 7,
      auditId: 44,
      runMonth: "2026-07",
      baselineMonth: "2026-06",
      comparisonMonth: "2026-07",
      baselineScore: 70,
      currentScore: 73.25,
      scoreDelta: 3.25,
      baselineSnapshotCount: 10,
      currentSnapshotCount: 12,
    });
  });

  it("creates a default manual action plan when adding an action item without an active plan", async () => {
    const { createGeoAeoActionItem } = await import("./geo-aeo-service.js");
    dbState.selectRows.push([]);
    dbState.insertReturningRows.push([{ id: 88, name: "30-day AI visibility action plan" }]);
    dbState.insertReturningRows.push([{ id: 89, actionPlanId: 88, title: "Create FAQ section" }]);

    const created = await createGeoAeoActionItem({
      tenantId: 7,
      auditId: 44,
      userId: 12,
      input: {
        title: "Create FAQ section",
        description: "Answer source-worthy service questions.",
        category: "faq_schema",
        priority: "high",
        weekNumber: 2,
        status: "draft",
      },
    });

    expect(created).toEqual({
      plan: { id: 88, name: "30-day AI visibility action plan" },
      item: { id: 89, actionPlanId: 88, title: "Create FAQ section" },
    });
    expect(dbState.insertValues).toMatchObject({
      tenantId: 7,
      auditId: 44,
      actionPlanId: 88,
      title: "Create FAQ section",
      category: "faq_schema",
      priority: "high",
      weekNumber: 2,
      status: "draft",
      createdById: 12,
      updatedById: 12,
    });
  });

  it("stores soft-delete metadata for manual action items", async () => {
    const { softDeleteGeoAeoActionItem } = await import("./geo-aeo-service.js");
    const deletedAtBeforeCall = Date.now();
    dbState.updateReturningRows.push([{ id: 89, auditId: 44 }]);

    const deleted = await softDeleteGeoAeoActionItem({
      tenantId: 7,
      actionItemId: 89,
      userId: 12,
    });

    expect(deleted).toEqual({ id: 89, auditId: 44 });
    expect(dbState.updateSet).toMatchObject({ updatedById: 12 });
    expect(dbState.updateSet?.deletedAt).toBeInstanceOf(Date);
    expect((dbState.updateSet?.deletedAt as Date).getTime()).toBeGreaterThanOrEqual(
      deletedAtBeforeCall,
    );
  });
});
