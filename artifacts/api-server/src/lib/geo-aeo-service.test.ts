import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  updateSet: undefined as Record<string, unknown> | undefined,
  updateSets: [] as Record<string, unknown>[],
  updateReturningRows: [] as unknown[][],
  insertValues: undefined as Record<string, unknown> | undefined,
  insertValuesList: [] as unknown[],
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

  const dbMock = {
    select: vi.fn(chainSelect),
    update: vi.fn(() => ({
      set: vi.fn((updates: Record<string, unknown>) => {
        dbState.updateSet = updates;
        dbState.updateSets.push(updates);
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
        dbState.insertValuesList.push(values);
        return {
          returning: vi.fn(async () => dbState.insertReturningRows.shift() ?? []),
        };
      }),
    })),
    transaction: vi.fn(async (callback: (tx: typeof dbMock) => unknown) => callback(dbMock)),
  };

  return {
    db: dbMock,
    geoAeoActionItemsTable: tableMock(),
    geoAeoActionPlansTable: tableMock(),
    geoAeoAnswerSnapshotsTable: tableMock(),
    geoAeoAuditsTable: tableMock(),
    geoAeoCitationsTable: tableMock(),
    geoAeoCompetitorsTable: tableMock(),
    geoAeoEnginesTable: tableMock(),
    geoAeoFindingsTable: tableMock(),
    geoAeoImportBatchesTable: tableMock(),
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
    dbState.updateSets = [];
    dbState.updateReturningRows = [];
    dbState.insertValues = undefined;
    dbState.insertValuesList = [];
    dbState.insertReturningRows = [];
    dbState.selectRows = [];
  });

  it("previews prompt CSV rows with invalid and duplicate counts", async () => {
    dbState.selectRows = [
      [{ id: 5, normalizedPrompt: "who cites us?", promptText: "Who cites us?" }],
    ];
    const { previewGeoAeoPromptCsv } = await import("./geo-aeo-service.js");

    const preview = await previewGeoAeoPromptCsv({
      tenantId: 7,
      auditId: 101,
      csvText:
        "promptText,priority\n" +
        "Who cites us?,50\n" +
        "What sources mention us?,60\n" +
        "What sources mention us?,70\n" +
        ",80",
    });

    expect(preview).toEqual({
      totalRows: 4,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 2,
      invalid: [{ row: 5, reason: "Required" }],
      duplicates: [
        { row: 2, reason: "Duplicate prompt text already exists in this audit." },
        { row: 4, reason: "Duplicate prompt text already appears on row 3." },
      ],
    });
  });

  it("previews snapshot CSV rows with missing prompt and duplicate counts", async () => {
    dbState.selectRows = [
      [{ id: 11 }],
      [
        {
          promptId: 11,
          engine: "chatgpt",
          answerHash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        },
      ],
    ];
    const { previewGeoAeoSnapshotCsv } = await import("./geo-aeo-service.js");

    const preview = await previewGeoAeoSnapshotCsv({
      tenantId: 7,
      auditId: 101,
      csvText:
        "promptId,engine,captureMethod,answerText\n" +
        "11,chatgpt,csv_import,hello\n" +
        "11,perplexity,csv_import,new answer\n" +
        "11,perplexity,csv_import,new answer\n" +
        "12,chatgpt,csv_import,missing prompt",
    });

    expect(preview).toEqual({
      totalRows: 4,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 2,
      invalid: [{ row: 5, reason: "Prompt 12 was not found in this audit." }],
      duplicates: [
        { row: 2, reason: "Duplicate snapshot already exists in this audit." },
        { row: 4, reason: "Duplicate snapshot already appears on row 3." },
      ],
    });
  });

  it("creates a snapshot CSV import batch and stamps imported snapshots", async () => {
    const { createGeoAeoSnapshotImportBatch } = await import("./geo-aeo-service.js");
    dbState.insertReturningRows.push([{ id: 901, importType: "snapshot_csv", importedRows: 2 }]);
    dbState.insertReturningRows.push([
      { id: 1001, importBatchId: 901, promptId: 11 },
      { id: 1002, importBatchId: 901, promptId: 12 },
    ]);

    const result = await createGeoAeoSnapshotImportBatch({
      tenantId: 7,
      auditId: 101,
      userId: 12,
      preview: {
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
        invalid: [],
        duplicates: [],
      },
      snapshots: [
        {
          auditId: 101,
          promptId: 11,
          engine: "chatgpt",
          captureMethod: "csv_import",
          answerText: "First answer",
        },
        {
          auditId: 101,
          promptId: 12,
          engine: "perplexity",
          captureMethod: "csv_import",
          answerText: "Second answer",
        },
      ],
    });

    expect(result.batch).toEqual({ id: 901, importType: "snapshot_csv", importedRows: 2 });
    expect(result.snapshots).toHaveLength(2);
    expect(dbState.insertValuesList[0]).toMatchObject({
      tenantId: 7,
      auditId: 101,
      importType: "snapshot_csv",
      totalRows: 2,
      importedRows: 2,
      createdById: 12,
    });
    expect(dbState.insertValuesList[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ importBatchId: 901, promptId: 11, answerText: "First answer" }),
        expect.objectContaining({ importBatchId: 901, promptId: 12, answerText: "Second answer" }),
      ]),
    );
  });

  it("rolls back a snapshot import batch by soft-deleting linked rows", async () => {
    const { rollbackGeoAeoSnapshotImportBatch } = await import("./geo-aeo-service.js");
    dbState.selectRows = [
      [{ id: 901, auditId: 101, status: "active", importedRows: 2 }],
      [{ id: 1001 }, { id: 1002 }],
    ];
    dbState.updateReturningRows.push([{ id: 901, auditId: 101, status: "rolled_back" }]);

    const rollback = await rollbackGeoAeoSnapshotImportBatch({
      tenantId: 7,
      importBatchId: 901,
      userId: 12,
    });

    expect(rollback).toEqual({
      batch: { id: 901, auditId: 101, status: "rolled_back" },
      rolledBackSnapshots: 2,
    });
    expect(dbState.updateSets).toHaveLength(4);
    expect(dbState.updateSets[0]?.deletedAt).toBeInstanceOf(Date);
    expect(dbState.updateSets[1]?.deletedAt).toBeInstanceOf(Date);
    expect(dbState.updateSets[2]?.deletedAt).toBeInstanceOf(Date);
    expect(dbState.updateSets[3]).toMatchObject({ status: "rolled_back", deletedById: 12 });
    expect(dbState.updateSets[3]?.deletedAt).toBeInstanceOf(Date);
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
            visibilityLabel: '=HYPERLINK("https://attacker.test")',
          },
          summary: {
            promptCount: 1,
            snapshotCount: 1,
            findingCount: 1,
            actionItemCount: 1,
          },
          prompts: [
            {
              id: 7,
              promptText: "=Ask about us",
              status: "approved",
              intent: "comparison",
              funnelStage: "consideration",
              serviceOrProduct: "Visibility",
              location: "US",
            },
          ],
          snapshots: [
            {
              id: 8,
              promptId: 7,
              engine: "chatgpt",
              captureMethod: "manual_paste",
              answerText: "+Snapshot formula",
              clientMentioned: true,
              clientCited: false,
            },
          ],
          findings: [
            {
              id: 1,
              title: "+SUM(1,2)",
              status: "approved",
              recommendation: '@IMPORTXML("https://attacker.test")',
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
    expect(exported?.body).toContain("'=Ask about us");
    expect(exported?.body).toContain("'+Snapshot formula");
    expect(exported?.body).toContain("'+SUM(1,2)");
    expect(exported?.body).toContain("'@IMPORTXML");
    expect(exported?.body).toContain("'-CMD");
    expect(exported?.body).toContain("prompt_matrix");
    expect(exported?.body).toContain("answer_snapshot");
    expect(exported?.body).toContain("limitations");
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
          prompts: [
            {
              id: 7,
              promptText: "Who recommends PDF Audit?",
              status: "approved",
              intent: "recommendation",
              funnelStage: "consideration",
              serviceOrProduct: "Local services",
              location: "US",
            },
          ],
          snapshots: [
            {
              id: 8,
              promptId: 7,
              engine: "perplexity",
              captureMethod: "manual_paste",
              answerText: "PDF Audit appears in the answer.",
              clientMentioned: true,
              clientCited: true,
            },
          ],
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
    expect(exported?.body).toContain("Prompt Matrix");
    expect(exported?.body).toContain("Methodology and Limitations");
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
