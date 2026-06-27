import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  calculateGeoAeoVisibilityScore,
  getGeoAeoScoreLabel,
  geoAeoPromptCreateSchema,
  geoAeoSnapshotCreateSchema,
  neutralizeCsvCell,
  parseCsvObjects,
  type GeoAeoScoreInputs,
  type GeoAeoAuditCreateInput,
  type GeoAeoAuditUpdateInput,
  type GeoAeoPromptCreateInput,
  type GeoAeoCitationCreateInput,
  type GeoAeoCompetitorCreateInput,
  type GeoAeoCompetitorUpdateInput,
  type GeoAeoSchemaFindingCreateInput,
  type GeoAeoSchemaFindingUpdateInput,
  type GeoAeoSnapshotCreateInput,
  type GeoAeoSnapshotUpdateInput,
  type GeoAeoSourceRecommendationCreateInput,
  type GeoAeoSourceRecommendationUpdateInput,
  type GeoAeoMonitoringRunCreateInput,
  type GeoAeoMonitoringRunUpdateInput,
  type GeoAeoActionItemCreateInput,
} from "@workspace/shared/geo-aeo";
import {
  db,
  geoAeoActionItemsTable,
  geoAeoActionPlansTable,
  geoAeoAnswerSnapshotsTable,
  geoAeoAuditsTable,
  geoAeoCitationsTable,
  geoAeoCompetitorsTable,
  geoAeoEnginesTable,
  geoAeoFindingsTable,
  geoAeoImportBatchesTable,
  geoAeoMentionsTable,
  geoAeoMonitoringRunsTable,
  geoAeoPromptsTable,
  geoAeoSchemaFindingsTable,
  geoAeoSourceRecommendationsTable,
  geoAeoVisibilityScoresTable,
  reportsTable,
} from "@workspace/db";

const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  google_ai_overviews: "Google AI Overviews",
  other: "Other",
};

type GeoAeoReportFormat = "markdown" | "csv" | "json" | "pdf";

const GEO_AEO_REPORT_METHODOLOGY = {
  dataSources: [
    "Manual prompt inventory",
    "Manual or CSV-imported answer snapshots",
    "Deterministic RankMap scoring and finding extraction",
    "Operator-reviewed action plans and manual fallback records",
  ],
  limitations: [
    "Answer-engine output can vary by account, location, time, personalization, and model release.",
    "Manual/mock snapshots are evidence samples, not a guarantee of future AI recommendations.",
    "RankMap does not guarantee citations, rankings, traffic, conversions, or revenue.",
    "Real provider calls remain disabled unless explicitly configured with approved provider credentials.",
  ],
};

export type GeoAeoCsvPreviewIssue = {
  row: number;
  reason: string;
};

export type GeoAeoCsvImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  invalid: GeoAeoCsvPreviewIssue[];
  duplicates: GeoAeoCsvPreviewIssue[];
};

export type GeoAeoSnapshotImportBatchResult = {
  batch: typeof geoAeoImportBatchesTable.$inferSelect;
  snapshots: (typeof geoAeoAnswerSnapshotsTable.$inferSelect)[];
};

export interface ListGeoAeoAuditsParams {
  tenantId: number;
  clientId?: number;
  projectId?: number;
  status?: string;
}

export async function listGeoAeoAudits(params: ListGeoAeoAuditsParams) {
  const conditions = [
    eq(geoAeoAuditsTable.tenantId, params.tenantId),
    isNull(geoAeoAuditsTable.deletedAt),
  ];

  if (params.clientId !== undefined) {
    conditions.push(eq(geoAeoAuditsTable.clientId, params.clientId));
  }

  if (params.projectId !== undefined) {
    conditions.push(eq(geoAeoAuditsTable.projectId, params.projectId));
  }

  if (params.status !== undefined) {
    conditions.push(eq(geoAeoAuditsTable.status, params.status));
  }

  return db
    .select()
    .from(geoAeoAuditsTable)
    .where(and(...conditions))
    .orderBy(desc(geoAeoAuditsTable.createdAt));
}

export async function createGeoAeoAudit(params: {
  tenantId: number;
  userId: number;
  input: GeoAeoAuditCreateInput;
}) {
  return db.transaction(async (tx) => {
    const [audit] = await tx
      .insert(geoAeoAuditsTable)
      .values({
        tenantId: params.tenantId,
        clientId: params.input.clientId,
        projectId: params.input.projectId ?? null,
        auditName: params.input.auditName,
        websiteUrl: params.input.websiteUrl,
        niche: params.input.niche,
        servicesOrProducts: params.input.servicesOrProducts,
        targetLocation: params.input.targetLocation ?? null,
        targetAudience: params.input.targetAudience ?? null,
        monitoringEnabled: params.input.monitoringEnabled,
        monitoringCadence: params.input.monitoringCadence,
        nextMonitoringRunAt: params.input.nextMonitoringRunAt
          ? new Date(params.input.nextMonitoringRunAt)
          : null,
        businessFacts: params.input.businessFacts,
        createdById: params.userId,
        updatedById: params.userId,
      })
      .returning();

    await tx.insert(geoAeoEnginesTable).values(
      params.input.targetEngines.map((engine) => ({
        tenantId: params.tenantId,
        auditId: audit.id,
        engine,
        displayName: ENGINE_DISPLAY_NAMES[engine] ?? engine,
        mode: "manual",
      })),
    );

    return audit;
  });
}

export async function updateGeoAeoAudit(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoAuditUpdateInput;
}) {
  const updates: Partial<typeof geoAeoAuditsTable.$inferInsert> = {
    updatedById: params.userId,
  };

  if (params.input.auditName !== undefined) updates.auditName = params.input.auditName;
  if (params.input.websiteUrl !== undefined) updates.websiteUrl = params.input.websiteUrl;
  if (params.input.niche !== undefined) updates.niche = params.input.niche;
  if (params.input.servicesOrProducts !== undefined) {
    updates.servicesOrProducts = params.input.servicesOrProducts;
  }
  if (params.input.targetLocation !== undefined)
    updates.targetLocation = params.input.targetLocation;
  if (params.input.targetAudience !== undefined)
    updates.targetAudience = params.input.targetAudience;
  if (params.input.businessFacts !== undefined) updates.businessFacts = params.input.businessFacts;
  if (params.input.status !== undefined) {
    updates.status = params.input.status;
    if (params.input.status === "approved") {
      updates.approvedAt = new Date();
      updates.approvedById = params.userId;
    }
  }
  if (params.input.summary !== undefined) updates.summary = params.input.summary;
  if (params.input.monitoringEnabled !== undefined) {
    updates.monitoringEnabled = params.input.monitoringEnabled;
  }
  if (params.input.monitoringCadence !== undefined) {
    updates.monitoringCadence = params.input.monitoringCadence;
  }
  if (params.input.nextMonitoringRunAt !== undefined) {
    updates.nextMonitoringRunAt = params.input.nextMonitoringRunAt
      ? new Date(params.input.nextMonitoringRunAt)
      : null;
  }

  const [audit] = await db
    .update(geoAeoAuditsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoAuditsTable.id, params.auditId),
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .returning();

  return audit ?? null;
}

export async function softDeleteGeoAeoAudit(params: {
  tenantId: number;
  auditId: number;
  userId: number;
}) {
  const [audit] = await db
    .update(geoAeoAuditsTable)
    .set({
      status: "archived",
      deletedAt: new Date(),
      updatedById: params.userId,
    })
    .where(
      and(
        eq(geoAeoAuditsTable.id, params.auditId),
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .returning({ id: geoAeoAuditsTable.id });

  return audit ?? null;
}

export async function listGeoAeoPrompts(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoPromptsTable)
    .where(
      and(
        eq(geoAeoPromptsTable.tenantId, params.tenantId),
        eq(geoAeoPromptsTable.auditId, params.auditId),
        isNull(geoAeoPromptsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoPromptsTable.priority, geoAeoPromptsTable.createdAt);
}

export async function createGeoAeoPrompt(params: {
  tenantId: number;
  userId: number;
  input: GeoAeoPromptCreateInput;
}) {
  const [prompt] = await db
    .insert(geoAeoPromptsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.input.auditId,
      promptSetId: params.input.promptSetId ?? null,
      promptText: params.input.promptText,
      normalizedPrompt: normalizePrompt(params.input.promptText),
      intent: params.input.intent ?? null,
      funnelStage: params.input.funnelStage ?? null,
      serviceOrProduct: params.input.serviceOrProduct ?? null,
      location: params.input.location ?? null,
      priority: params.input.priority,
      createdById: params.userId,
      updatedById: params.userId,
    })
    .returning();

  return prompt;
}

export function parseGeoAeoPromptCsv(
  csvText: string,
  auditId: number,
): {
  prompts: GeoAeoPromptCreateInput[];
  errors: string[];
} {
  const prompts: GeoAeoPromptCreateInput[] = [];
  const errors: string[] = [];

  parseCsvObjects(csvText).forEach((row, index) => {
    const priority = parseOptionalIntegerInRange(row.priority, 0, 100);
    if (priority === null) {
      errors.push(`Row ${index + 2}: Invalid priority`);
      return;
    }

    const parsed = geoAeoPromptCreateSchema.safeParse({
      auditId,
      promptText: row.promptText || row.prompt || row.question,
      intent: emptyToUndefined(row.intent),
      funnelStage: emptyToUndefined(row.funnelStage),
      serviceOrProduct: emptyToUndefined(row.serviceOrProduct),
      location: emptyToUndefined(row.location),
      priority,
    });

    if (!parsed.success) {
      errors.push(
        `Row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      );
      return;
    }

    prompts.push(parsed.data);
  });

  return { prompts, errors };
}

export async function previewGeoAeoPromptCsv(params: {
  tenantId: number;
  auditId: number;
  csvText: string;
}): Promise<GeoAeoCsvImportPreview> {
  const existingPrompts = await db
    .select({
      id: geoAeoPromptsTable.id,
      normalizedPrompt: geoAeoPromptsTable.normalizedPrompt,
      promptText: geoAeoPromptsTable.promptText,
    })
    .from(geoAeoPromptsTable)
    .where(
      and(
        eq(geoAeoPromptsTable.tenantId, params.tenantId),
        eq(geoAeoPromptsTable.auditId, params.auditId),
        isNull(geoAeoPromptsTable.deletedAt),
      ),
    );

  const existingNormalized = new Set(
    existingPrompts.map((prompt) => prompt.normalizedPrompt ?? normalizePrompt(prompt.promptText)),
  );
  const seenNormalized = new Map<string, number>();
  const invalid: GeoAeoCsvPreviewIssue[] = [];
  const duplicates: GeoAeoCsvPreviewIssue[] = [];

  parseCsvObjects(params.csvText).forEach((row, index) => {
    const rowNumber = index + 2;
    const priority = parseOptionalIntegerInRange(row.priority, 0, 100);
    if (priority === null) {
      invalid.push({
        row: rowNumber,
        reason: "Invalid priority",
      });
      return;
    }

    const parsed = geoAeoPromptCreateSchema.safeParse({
      auditId: params.auditId,
      promptText: row.promptText || row.prompt || row.question,
      intent: emptyToUndefined(row.intent),
      funnelStage: emptyToUndefined(row.funnelStage),
      serviceOrProduct: emptyToUndefined(row.serviceOrProduct),
      location: emptyToUndefined(row.location),
      priority,
    });

    if (!parsed.success) {
      invalid.push({
        row: rowNumber,
        reason: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    const normalizedPrompt = normalizePrompt(parsed.data.promptText);
    const firstSeenRow = seenNormalized.get(normalizedPrompt);
    if (firstSeenRow !== undefined) {
      duplicates.push({
        row: rowNumber,
        reason: `Duplicate prompt text already appears on row ${firstSeenRow}.`,
      });
      return;
    }
    if (existingNormalized.has(normalizedPrompt)) {
      duplicates.push({
        row: rowNumber,
        reason: "Duplicate prompt text already exists in this audit.",
      });
      return;
    }

    seenNormalized.set(normalizedPrompt, rowNumber);
  });

  const totalRows = parseCsvObjects(params.csvText).length;
  const duplicateRows = duplicates.length;
  const invalidRows = invalid.length;

  return {
    totalRows,
    validRows: Math.max(totalRows - invalidRows - duplicateRows, 0),
    invalidRows,
    duplicateRows,
    invalid,
    duplicates,
  };
}

export async function createGeoAeoPrompts(params: {
  tenantId: number;
  userId: number;
  prompts: GeoAeoPromptCreateInput[];
}) {
  if (params.prompts.length === 0) return [];

  return db
    .insert(geoAeoPromptsTable)
    .values(
      params.prompts.map((prompt) => ({
        tenantId: params.tenantId,
        auditId: prompt.auditId,
        promptSetId: prompt.promptSetId ?? null,
        promptText: prompt.promptText,
        normalizedPrompt: normalizePrompt(prompt.promptText),
        intent: prompt.intent ?? null,
        funnelStage: prompt.funnelStage ?? null,
        serviceOrProduct: prompt.serviceOrProduct ?? null,
        location: prompt.location ?? null,
        priority: prompt.priority,
        createdById: params.userId,
        updatedById: params.userId,
      })),
    )
    .returning();
}

export async function listGeoAeoAnswerSnapshots(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoAnswerSnapshotsTable)
    .where(
      and(
        eq(geoAeoAnswerSnapshotsTable.tenantId, params.tenantId),
        eq(geoAeoAnswerSnapshotsTable.auditId, params.auditId),
        isNull(geoAeoAnswerSnapshotsTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoAnswerSnapshotsTable.capturedAt));
}

export async function createGeoAeoAnswerSnapshot(params: {
  tenantId: number;
  userId: number;
  input: GeoAeoSnapshotCreateInput;
}) {
  const [snapshot] = await db
    .insert(geoAeoAnswerSnapshotsTable)
    .values(toAnswerSnapshotInsert(params.tenantId, params.userId, params.input))
    .returning();

  return snapshot;
}

export function parseGeoAeoSnapshotCsv(
  csvText: string,
  auditId: number,
): {
  snapshots: GeoAeoSnapshotCreateInput[];
  errors: string[];
} {
  const snapshots: GeoAeoSnapshotCreateInput[] = [];
  const errors: string[] = [];

  parseCsvObjects(csvText).forEach((row, index) => {
    const promptId = parseOptionalPositiveInteger(row.promptId);
    if (promptId === null) {
      errors.push(`Row ${index + 2}: Invalid promptId`);
      return;
    }

    const promptVariantId = parseOptionalPositiveInteger(row.promptVariantId);
    if (promptVariantId === null) {
      errors.push(`Row ${index + 2}: Invalid promptVariantId`);
      return;
    }

    const parsed = geoAeoSnapshotCreateSchema.safeParse({
      auditId,
      promptId,
      promptVariantId,
      engine: row.engine,
      captureMethod: row.captureMethod || "csv_import",
      answerText: row.answerText || row.answer,
      capturedAt: emptyToUndefined(row.capturedAt),
      locationContext: emptyToUndefined(row.locationContext),
    });

    if (!parsed.success) {
      errors.push(
        `Row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      );
      return;
    }

    snapshots.push(parsed.data);
  });

  return { snapshots, errors };
}

export async function previewGeoAeoSnapshotCsv(params: {
  tenantId: number;
  auditId: number;
  csvText: string;
}): Promise<GeoAeoCsvImportPreview> {
  const [existingPrompts, existingSnapshots] = await Promise.all([
    db
      .select({ id: geoAeoPromptsTable.id })
      .from(geoAeoPromptsTable)
      .where(
        and(
          eq(geoAeoPromptsTable.tenantId, params.tenantId),
          eq(geoAeoPromptsTable.auditId, params.auditId),
          isNull(geoAeoPromptsTable.deletedAt),
        ),
      ),
    db
      .select({
        promptId: geoAeoAnswerSnapshotsTable.promptId,
        engine: geoAeoAnswerSnapshotsTable.engine,
        answerHash: geoAeoAnswerSnapshotsTable.answerHash,
      })
      .from(geoAeoAnswerSnapshotsTable)
      .where(
        and(
          eq(geoAeoAnswerSnapshotsTable.tenantId, params.tenantId),
          eq(geoAeoAnswerSnapshotsTable.auditId, params.auditId),
          isNull(geoAeoAnswerSnapshotsTable.deletedAt),
        ),
      ),
  ]);

  const promptIds = new Set(existingPrompts.map((prompt) => prompt.id));
  const existingSnapshotKeys = new Set(
    existingSnapshots.map((snapshot) =>
      snapshotDuplicateKey(snapshot.promptId, snapshot.engine, snapshot.answerHash),
    ),
  );
  const seenSnapshotKeys = new Map<string, number>();
  const invalid: GeoAeoCsvPreviewIssue[] = [];
  const duplicates: GeoAeoCsvPreviewIssue[] = [];

  parseCsvObjects(params.csvText).forEach((row, index) => {
    const rowNumber = index + 2;
    const promptId = parseOptionalPositiveInteger(row.promptId);
    if (promptId === null) {
      invalid.push({
        row: rowNumber,
        reason: "Invalid promptId",
      });
      return;
    }

    const promptVariantId = parseOptionalPositiveInteger(row.promptVariantId);
    if (promptVariantId === null) {
      invalid.push({
        row: rowNumber,
        reason: "Invalid promptVariantId",
      });
      return;
    }

    const parsed = geoAeoSnapshotCreateSchema.safeParse({
      auditId: params.auditId,
      promptId,
      promptVariantId,
      engine: row.engine,
      captureMethod: row.captureMethod || "csv_import",
      answerText: row.answerText || row.answer,
      capturedAt: emptyToUndefined(row.capturedAt),
      locationContext: emptyToUndefined(row.locationContext),
    });

    if (!parsed.success) {
      invalid.push({
        row: rowNumber,
        reason: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    if (!promptIds.has(parsed.data.promptId)) {
      invalid.push({
        row: rowNumber,
        reason: `Prompt ${parsed.data.promptId} was not found in this audit.`,
      });
      return;
    }

    const key = snapshotDuplicateKey(
      parsed.data.promptId,
      parsed.data.engine,
      createAnswerHash(parsed.data.answerText),
    );
    const firstSeenRow = seenSnapshotKeys.get(key);
    if (firstSeenRow !== undefined) {
      duplicates.push({
        row: rowNumber,
        reason: `Duplicate snapshot already appears on row ${firstSeenRow}.`,
      });
      return;
    }
    if (existingSnapshotKeys.has(key)) {
      duplicates.push({
        row: rowNumber,
        reason: "Duplicate snapshot already exists in this audit.",
      });
      return;
    }

    seenSnapshotKeys.set(key, rowNumber);
  });

  const totalRows = parseCsvObjects(params.csvText).length;
  const duplicateRows = duplicates.length;
  const invalidRows = invalid.length;

  return {
    totalRows,
    validRows: Math.max(totalRows - invalidRows - duplicateRows, 0),
    invalidRows,
    duplicateRows,
    invalid,
    duplicates,
  };
}

export async function createGeoAeoAnswerSnapshots(params: {
  tenantId: number;
  userId: number;
  snapshots: GeoAeoSnapshotCreateInput[];
}) {
  if (params.snapshots.length === 0) return [];

  return db
    .insert(geoAeoAnswerSnapshotsTable)
    .values(
      params.snapshots.map((snapshot) =>
        toAnswerSnapshotInsert(params.tenantId, params.userId, snapshot),
      ),
    )
    .returning();
}

export async function createGeoAeoSnapshotImportBatch(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  snapshots: GeoAeoSnapshotCreateInput[];
  preview: GeoAeoCsvImportPreview;
}): Promise<GeoAeoSnapshotImportBatchResult> {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(geoAeoImportBatchesTable)
      .values({
        tenantId: params.tenantId,
        auditId: params.auditId,
        importType: "snapshot_csv",
        source: "csv",
        status: "active",
        totalRows: params.preview.totalRows,
        importedRows: params.snapshots.length,
        invalidRows: params.preview.invalidRows,
        duplicateRows: params.preview.duplicateRows,
        createdById: params.userId,
      })
      .returning();

    const snapshots =
      params.snapshots.length === 0
        ? []
        : await tx
            .insert(geoAeoAnswerSnapshotsTable)
            .values(
              params.snapshots.map((snapshot) =>
                toAnswerSnapshotInsert(params.tenantId, params.userId, snapshot, batch.id),
              ),
            )
            .returning();

    return { batch, snapshots };
  });
}

export async function listGeoAeoSnapshotImportBatches(params: {
  tenantId: number;
  auditId: number;
}) {
  return db
    .select()
    .from(geoAeoImportBatchesTable)
    .where(
      and(
        eq(geoAeoImportBatchesTable.tenantId, params.tenantId),
        eq(geoAeoImportBatchesTable.auditId, params.auditId),
        eq(geoAeoImportBatchesTable.importType, "snapshot_csv"),
        isNull(geoAeoImportBatchesTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoImportBatchesTable.createdAt));
}

export async function rollbackGeoAeoSnapshotImportBatch(params: {
  tenantId: number;
  importBatchId: number;
  userId: number;
}) {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(geoAeoImportBatchesTable)
      .where(
        and(
          eq(geoAeoImportBatchesTable.tenantId, params.tenantId),
          eq(geoAeoImportBatchesTable.id, params.importBatchId),
          eq(geoAeoImportBatchesTable.importType, "snapshot_csv"),
          eq(geoAeoImportBatchesTable.status, "active"),
          isNull(geoAeoImportBatchesTable.deletedAt),
        ),
      )
      .limit(1);

    if (!batch) return null;

    const importedSnapshots = await tx
      .select({ id: geoAeoAnswerSnapshotsTable.id })
      .from(geoAeoAnswerSnapshotsTable)
      .where(
        and(
          eq(geoAeoAnswerSnapshotsTable.tenantId, params.tenantId),
          eq(geoAeoAnswerSnapshotsTable.importBatchId, params.importBatchId),
          isNull(geoAeoAnswerSnapshotsTable.deletedAt),
        ),
      );
    const snapshotIds = importedSnapshots.map((snapshot) => snapshot.id);
    const deletedAt = new Date();

    if (snapshotIds.length > 0) {
      await tx
        .update(geoAeoCitationsTable)
        .set({ deletedAt })
        .where(
          and(
            eq(geoAeoCitationsTable.tenantId, params.tenantId),
            inArray(geoAeoCitationsTable.snapshotId, snapshotIds),
            isNull(geoAeoCitationsTable.deletedAt),
          ),
        );

      await tx
        .update(geoAeoMentionsTable)
        .set({ deletedAt })
        .where(
          and(
            eq(geoAeoMentionsTable.tenantId, params.tenantId),
            inArray(geoAeoMentionsTable.snapshotId, snapshotIds),
            isNull(geoAeoMentionsTable.deletedAt),
          ),
        );

      await tx
        .update(geoAeoAnswerSnapshotsTable)
        .set({ deletedAt })
        .where(
          and(
            eq(geoAeoAnswerSnapshotsTable.tenantId, params.tenantId),
            eq(geoAeoAnswerSnapshotsTable.importBatchId, params.importBatchId),
            isNull(geoAeoAnswerSnapshotsTable.deletedAt),
          ),
        );
    }

    const [rolledBackBatch] = await tx
      .update(geoAeoImportBatchesTable)
      .set({
        status: "rolled_back",
        deletedAt,
        deletedById: params.userId,
      })
      .where(
        and(
          eq(geoAeoImportBatchesTable.tenantId, params.tenantId),
          eq(geoAeoImportBatchesTable.id, params.importBatchId),
          isNull(geoAeoImportBatchesTable.deletedAt),
        ),
      )
      .returning();

    return {
      batch: rolledBackBatch ?? batch,
      rolledBackSnapshots: snapshotIds.length,
    };
  });
}

export async function updateGeoAeoAnswerSnapshot(params: {
  tenantId: number;
  snapshotId: number;
  input: GeoAeoSnapshotUpdateInput;
}) {
  const updates: Partial<typeof geoAeoAnswerSnapshotsTable.$inferInsert> = {};
  if (params.input.clientMentioned !== undefined)
    updates.clientMentioned = params.input.clientMentioned;
  if (params.input.clientCited !== undefined) updates.clientCited = params.input.clientCited;
  if (params.input.sentiment !== undefined) updates.sentiment = params.input.sentiment;
  if (params.input.accuracyRiskScore !== undefined) {
    updates.accuracyRiskScore = params.input.accuracyRiskScore;
  }
  if (params.input.locationContext !== undefined)
    updates.locationContext = params.input.locationContext;

  const [snapshot] = await db
    .update(geoAeoAnswerSnapshotsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoAnswerSnapshotsTable.tenantId, params.tenantId),
        eq(geoAeoAnswerSnapshotsTable.id, params.snapshotId),
        isNull(geoAeoAnswerSnapshotsTable.deletedAt),
      ),
    )
    .returning();

  return snapshot ?? null;
}

export async function listGeoAeoCompetitors(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoCompetitorsTable)
    .where(
      and(
        eq(geoAeoCompetitorsTable.tenantId, params.tenantId),
        eq(geoAeoCompetitorsTable.auditId, params.auditId),
        isNull(geoAeoCompetitorsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoCompetitorsTable.name);
}

export async function createGeoAeoCompetitor(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoCompetitorCreateInput;
}) {
  const [competitor] = await db
    .insert(geoAeoCompetitorsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      name: params.input.name,
      websiteUrl: params.input.websiteUrl ?? null,
      aliases: params.input.aliases,
      notes: params.input.notes ?? null,
      createdById: params.userId,
    })
    .returning();

  return competitor;
}

export async function updateGeoAeoCompetitor(params: {
  tenantId: number;
  competitorId: number;
  input: GeoAeoCompetitorUpdateInput;
}) {
  const updates: Partial<typeof geoAeoCompetitorsTable.$inferInsert> = {};
  if (params.input.name !== undefined) updates.name = params.input.name;
  if (params.input.websiteUrl !== undefined) updates.websiteUrl = params.input.websiteUrl;
  if (params.input.aliases !== undefined) updates.aliases = params.input.aliases;
  if (params.input.notes !== undefined) updates.notes = params.input.notes;

  const [competitor] = await db
    .update(geoAeoCompetitorsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoCompetitorsTable.tenantId, params.tenantId),
        eq(geoAeoCompetitorsTable.id, params.competitorId),
        isNull(geoAeoCompetitorsTable.deletedAt),
      ),
    )
    .returning();

  return competitor ?? null;
}

export async function softDeleteGeoAeoCompetitor(params: {
  tenantId: number;
  competitorId: number;
  userId: number;
}) {
  const [competitor] = await db
    .update(geoAeoCompetitorsTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(geoAeoCompetitorsTable.tenantId, params.tenantId),
        eq(geoAeoCompetitorsTable.id, params.competitorId),
        isNull(geoAeoCompetitorsTable.deletedAt),
      ),
    )
    .returning({ id: geoAeoCompetitorsTable.id, auditId: geoAeoCompetitorsTable.auditId });

  return competitor ?? null;
}

export async function listGeoAeoCitations(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoCitationsTable)
    .where(
      and(
        eq(geoAeoCitationsTable.tenantId, params.tenantId),
        eq(geoAeoCitationsTable.auditId, params.auditId),
        isNull(geoAeoCitationsTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoCitationsTable.createdAt));
}

export async function createGeoAeoCitation(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoCitationCreateInput;
}) {
  const [citation] = await db
    .insert(geoAeoCitationsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      snapshotId: params.input.snapshotId ?? null,
      url: params.input.url ?? null,
      sourceName: params.input.sourceName ?? null,
      sourceType: params.input.sourceType ?? null,
      isClientOwned: params.input.isClientOwned,
      isCompetitorOwned: params.input.isCompetitorOwned,
      authorityEstimate: params.input.authorityEstimate ?? null,
      notes: params.input.notes ?? null,
      createdById: params.userId,
    })
    .returning();

  return citation;
}

export async function softDeleteGeoAeoCitation(params: { tenantId: number; citationId: number }) {
  const [citation] = await db
    .update(geoAeoCitationsTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(geoAeoCitationsTable.tenantId, params.tenantId),
        eq(geoAeoCitationsTable.id, params.citationId),
        isNull(geoAeoCitationsTable.deletedAt),
      ),
    )
    .returning({ id: geoAeoCitationsTable.id, auditId: geoAeoCitationsTable.auditId });

  return citation ?? null;
}

export async function listGeoAeoSourceRecommendations(params: {
  tenantId: number;
  auditId: number;
}) {
  return db
    .select()
    .from(geoAeoSourceRecommendationsTable)
    .where(
      and(
        eq(geoAeoSourceRecommendationsTable.tenantId, params.tenantId),
        eq(geoAeoSourceRecommendationsTable.auditId, params.auditId),
        isNull(geoAeoSourceRecommendationsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoSourceRecommendationsTable.priority, geoAeoSourceRecommendationsTable.createdAt);
}

export async function createGeoAeoSourceRecommendation(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoSourceRecommendationCreateInput;
}) {
  const [recommendation] = await db
    .insert(geoAeoSourceRecommendationsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      sourceName: params.input.sourceName,
      sourceUrl: params.input.sourceUrl ?? null,
      sourceType: params.input.sourceType ?? null,
      reason: params.input.reason ?? null,
      priority: params.input.priority,
      status: params.input.status,
      createdById: params.userId,
      updatedById: params.userId,
    })
    .returning();

  return recommendation;
}

export async function updateGeoAeoSourceRecommendation(params: {
  tenantId: number;
  sourceRecommendationId: number;
  userId: number;
  input: GeoAeoSourceRecommendationUpdateInput;
}) {
  const updates: Partial<typeof geoAeoSourceRecommendationsTable.$inferInsert> = {
    updatedById: params.userId,
  };
  if (params.input.sourceName !== undefined) updates.sourceName = params.input.sourceName;
  if (params.input.sourceUrl !== undefined) updates.sourceUrl = params.input.sourceUrl;
  if (params.input.sourceType !== undefined) updates.sourceType = params.input.sourceType;
  if (params.input.reason !== undefined) updates.reason = params.input.reason;
  if (params.input.priority !== undefined) updates.priority = params.input.priority;
  if (params.input.status !== undefined) updates.status = params.input.status;

  const [recommendation] = await db
    .update(geoAeoSourceRecommendationsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoSourceRecommendationsTable.tenantId, params.tenantId),
        eq(geoAeoSourceRecommendationsTable.id, params.sourceRecommendationId),
        isNull(geoAeoSourceRecommendationsTable.deletedAt),
      ),
    )
    .returning();

  return recommendation ?? null;
}

export async function softDeleteGeoAeoSourceRecommendation(params: {
  tenantId: number;
  sourceRecommendationId: number;
  userId: number;
}) {
  const [recommendation] = await db
    .update(geoAeoSourceRecommendationsTable)
    .set({ deletedAt: new Date(), updatedById: params.userId })
    .where(
      and(
        eq(geoAeoSourceRecommendationsTable.tenantId, params.tenantId),
        eq(geoAeoSourceRecommendationsTable.id, params.sourceRecommendationId),
        isNull(geoAeoSourceRecommendationsTable.deletedAt),
      ),
    )
    .returning({
      id: geoAeoSourceRecommendationsTable.id,
      auditId: geoAeoSourceRecommendationsTable.auditId,
    });

  return recommendation ?? null;
}

export async function listGeoAeoSchemaFindings(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoSchemaFindingsTable)
    .where(
      and(
        eq(geoAeoSchemaFindingsTable.tenantId, params.tenantId),
        eq(geoAeoSchemaFindingsTable.auditId, params.auditId),
        isNull(geoAeoSchemaFindingsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoSchemaFindingsTable.severity, geoAeoSchemaFindingsTable.createdAt);
}

export async function createGeoAeoSchemaFinding(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoSchemaFindingCreateInput;
}) {
  const [findingRecord] = await db
    .insert(geoAeoSchemaFindingsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      pageUrl: params.input.pageUrl ?? null,
      schemaType: params.input.schemaType ?? null,
      issueType: params.input.issueType,
      severity: params.input.severity,
      recommendation: params.input.recommendation ?? null,
      status: params.input.status,
      createdById: params.userId,
      updatedById: params.userId,
    })
    .returning();

  return findingRecord;
}

export async function updateGeoAeoSchemaFinding(params: {
  tenantId: number;
  schemaFindingId: number;
  userId: number;
  input: GeoAeoSchemaFindingUpdateInput;
}) {
  const updates: Partial<typeof geoAeoSchemaFindingsTable.$inferInsert> = {
    updatedById: params.userId,
  };
  if (params.input.pageUrl !== undefined) updates.pageUrl = params.input.pageUrl;
  if (params.input.schemaType !== undefined) updates.schemaType = params.input.schemaType;
  if (params.input.issueType !== undefined) updates.issueType = params.input.issueType;
  if (params.input.severity !== undefined) updates.severity = params.input.severity;
  if (params.input.recommendation !== undefined)
    updates.recommendation = params.input.recommendation;
  if (params.input.status !== undefined) updates.status = params.input.status;

  const [findingRecord] = await db
    .update(geoAeoSchemaFindingsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoSchemaFindingsTable.tenantId, params.tenantId),
        eq(geoAeoSchemaFindingsTable.id, params.schemaFindingId),
        isNull(geoAeoSchemaFindingsTable.deletedAt),
      ),
    )
    .returning();

  return findingRecord ?? null;
}

export async function softDeleteGeoAeoSchemaFinding(params: {
  tenantId: number;
  schemaFindingId: number;
  userId: number;
}) {
  const [findingRecord] = await db
    .update(geoAeoSchemaFindingsTable)
    .set({ deletedAt: new Date(), updatedById: params.userId })
    .where(
      and(
        eq(geoAeoSchemaFindingsTable.tenantId, params.tenantId),
        eq(geoAeoSchemaFindingsTable.id, params.schemaFindingId),
        isNull(geoAeoSchemaFindingsTable.deletedAt),
      ),
    )
    .returning({ id: geoAeoSchemaFindingsTable.id, auditId: geoAeoSchemaFindingsTable.auditId });

  return findingRecord ?? null;
}

export async function listGeoAeoMonitoringRuns(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoMonitoringRunsTable)
    .where(
      and(
        eq(geoAeoMonitoringRunsTable.tenantId, params.tenantId),
        eq(geoAeoMonitoringRunsTable.auditId, params.auditId),
        isNull(geoAeoMonitoringRunsTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoMonitoringRunsTable.runMonth), desc(geoAeoMonitoringRunsTable.createdAt));
}

export async function listApprovedGeoAeoMonitoringRuns(params: {
  tenantId: number;
  auditId: number;
}) {
  return db
    .select()
    .from(geoAeoMonitoringRunsTable)
    .where(
      and(
        eq(geoAeoMonitoringRunsTable.tenantId, params.tenantId),
        eq(geoAeoMonitoringRunsTable.auditId, params.auditId),
        eq(geoAeoMonitoringRunsTable.status, "approved"),
        isNull(geoAeoMonitoringRunsTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoMonitoringRunsTable.runMonth), desc(geoAeoMonitoringRunsTable.createdAt));
}

export async function createGeoAeoMonitoringRun(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoMonitoringRunCreateInput;
}) {
  const [run] = await db
    .insert(geoAeoMonitoringRunsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      runMonth: params.input.runMonth,
      baselineMonth: params.input.baselineMonth ?? null,
      comparisonMonth: params.input.comparisonMonth ?? params.input.runMonth,
      status: "draft",
      baselineScore: params.input.baselineScore ?? null,
      currentScore: params.input.currentScore ?? null,
      scoreDelta: calculateMonitoringScoreDelta(
        params.input.baselineScore,
        params.input.currentScore,
      ),
      baselineSnapshotCount: params.input.baselineSnapshotCount,
      currentSnapshotCount: params.input.currentSnapshotCount,
      actionPlanTemplate: params.input.actionPlanTemplate,
      reportTemplate: params.input.reportTemplate,
      summary: params.input.summary ?? null,
      notes: params.input.notes ?? null,
      createdById: params.userId,
      updatedById: params.userId,
    })
    .returning();

  return run;
}

export async function updateGeoAeoMonitoringRun(params: {
  tenantId: number;
  monitoringRunId: number;
  userId: number;
  input: GeoAeoMonitoringRunUpdateInput;
}) {
  const updates: Partial<typeof geoAeoMonitoringRunsTable.$inferInsert> = {
    updatedById: params.userId,
  };
  if (params.input.runMonth !== undefined) updates.runMonth = params.input.runMonth;
  if (params.input.baselineMonth !== undefined) updates.baselineMonth = params.input.baselineMonth;
  if (params.input.comparisonMonth !== undefined)
    updates.comparisonMonth = params.input.comparisonMonth;
  if (params.input.baselineScore !== undefined) updates.baselineScore = params.input.baselineScore;
  if (params.input.currentScore !== undefined) updates.currentScore = params.input.currentScore;
  if (params.input.baselineSnapshotCount !== undefined) {
    updates.baselineSnapshotCount = params.input.baselineSnapshotCount;
  }
  if (params.input.currentSnapshotCount !== undefined) {
    updates.currentSnapshotCount = params.input.currentSnapshotCount;
  }
  if (params.input.actionPlanTemplate !== undefined) {
    updates.actionPlanTemplate = params.input.actionPlanTemplate;
  }
  if (params.input.reportTemplate !== undefined)
    updates.reportTemplate = params.input.reportTemplate;
  if (params.input.summary !== undefined) updates.summary = params.input.summary;
  if (params.input.notes !== undefined) updates.notes = params.input.notes;
  if (params.input.status !== undefined) {
    updates.status = params.input.status;
    if (params.input.status === "approved") {
      updates.approvedAt = new Date();
      updates.approvedById = params.userId;
    }
  }

  if (params.input.baselineScore !== undefined || params.input.currentScore !== undefined) {
    const [existing] = await db
      .select({
        baselineScore: geoAeoMonitoringRunsTable.baselineScore,
        currentScore: geoAeoMonitoringRunsTable.currentScore,
      })
      .from(geoAeoMonitoringRunsTable)
      .where(
        and(
          eq(geoAeoMonitoringRunsTable.tenantId, params.tenantId),
          eq(geoAeoMonitoringRunsTable.id, params.monitoringRunId),
          isNull(geoAeoMonitoringRunsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) return null;
    updates.scoreDelta = calculateMonitoringScoreDelta(
      params.input.baselineScore ?? existing.baselineScore ?? undefined,
      params.input.currentScore ?? existing.currentScore ?? undefined,
    );
  }

  const [run] = await db
    .update(geoAeoMonitoringRunsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoMonitoringRunsTable.tenantId, params.tenantId),
        eq(geoAeoMonitoringRunsTable.id, params.monitoringRunId),
        isNull(geoAeoMonitoringRunsTable.deletedAt),
      ),
    )
    .returning();

  return run ?? null;
}

export async function listGeoAeoFindings(params: { tenantId: number; auditId: number }) {
  return db
    .select()
    .from(geoAeoFindingsTable)
    .where(
      and(
        eq(geoAeoFindingsTable.tenantId, params.tenantId),
        eq(geoAeoFindingsTable.auditId, params.auditId),
        isNull(geoAeoFindingsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoFindingsTable.severity, geoAeoFindingsTable.createdAt);
}

export async function updateGeoAeoFinding(params: {
  tenantId: number;
  findingId: number;
  userId: number;
  input: {
    findingType?: string;
    title?: string;
    description?: string;
    recommendation?: string;
    status?: string;
  };
}) {
  const updates: Partial<typeof geoAeoFindingsTable.$inferInsert> = {
    updatedById: params.userId,
  };

  if (params.input.findingType !== undefined) updates.findingType = params.input.findingType;
  if (params.input.title !== undefined) updates.title = params.input.title;
  if (params.input.description !== undefined) updates.description = params.input.description;
  if (params.input.recommendation !== undefined)
    updates.recommendation = params.input.recommendation;
  if (params.input.status !== undefined) {
    updates.status = params.input.status;
    if (params.input.status === "approved") {
      updates.approvedAt = new Date();
      updates.approvedById = params.userId;
    }
    if (params.input.status === "deleted") {
      updates.deletedAt = new Date();
    }
  }

  const [findingRecord] = await db
    .update(geoAeoFindingsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoFindingsTable.tenantId, params.tenantId),
        eq(geoAeoFindingsTable.id, params.findingId),
        isNull(geoAeoFindingsTable.deletedAt),
      ),
    )
    .returning();

  return findingRecord ?? null;
}

export async function analyzeGeoAeoAudit(params: {
  tenantId: number;
  auditId: number;
  userId: number;
}) {
  const [audit] = await db
    .select()
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.id, params.auditId),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!audit) return null;

  const [prompts, snapshots, competitors] = await Promise.all([
    listGeoAeoPrompts({ tenantId: params.tenantId, auditId: params.auditId }),
    listGeoAeoAnswerSnapshots({ tenantId: params.tenantId, auditId: params.auditId }),
    db
      .select()
      .from(geoAeoCompetitorsTable)
      .where(
        and(
          eq(geoAeoCompetitorsTable.tenantId, params.tenantId),
          eq(geoAeoCompetitorsTable.auditId, params.auditId),
          isNull(geoAeoCompetitorsTable.deletedAt),
        ),
      ),
  ]);

  const brandTerms = extractBrandTerms(audit.websiteUrl, audit.auditName);
  const mentionRows: (typeof geoAeoMentionsTable.$inferInsert)[] = [];
  const citationRows: (typeof geoAeoCitationsTable.$inferInsert)[] = [];

  for (const snapshot of snapshots) {
    const answerText = snapshot.answerText;
    const clientMentioned = includesAny(answerText, brandTerms);
    if (clientMentioned) {
      mentionRows.push({
        tenantId: params.tenantId,
        auditId: params.auditId,
        snapshotId: snapshot.id,
        mentionedEntityType: "client_brand",
        mentionedEntityName: audit.auditName,
        isClient: true,
        isCompetitor: false,
        evidenceSnippet: snippetAround(answerText, brandTerms),
        confidenceScore: 90,
      });
    }

    for (const competitor of competitors) {
      const competitorTerms = [
        competitor.name,
        competitor.websiteUrl ? hostWithoutWww(competitor.websiteUrl) : "",
      ].filter(Boolean);
      if (includesAny(answerText, competitorTerms)) {
        mentionRows.push({
          tenantId: params.tenantId,
          auditId: params.auditId,
          snapshotId: snapshot.id,
          mentionedEntityType: "competitor",
          mentionedEntityName: competitor.name,
          isClient: false,
          isCompetitor: true,
          evidenceSnippet: snippetAround(answerText, competitorTerms),
          confidenceScore: 80,
        });
      }
    }

    for (const url of extractUrls(answerText)) {
      const sourceHost = hostWithoutWww(url);
      citationRows.push({
        tenantId: params.tenantId,
        auditId: params.auditId,
        snapshotId: snapshot.id,
        url,
        sourceName: sourceHost,
        sourceType: "answer_snapshot",
        isClientOwned: includesAny(sourceHost, brandTerms),
        isCompetitorOwned: competitors.some((competitor) =>
          includesAny(sourceHost, [competitor.name, competitor.websiteUrl ?? ""]),
        ),
        createdById: params.userId,
      });
    }
  }

  const clientMentionSnapshotIds = new Set(
    mentionRows.filter((row) => row.isClient).map((row) => row.snapshotId),
  );
  const competitorMentionSnapshotIds = new Set(
    mentionRows.filter((row) => row.isCompetitor).map((row) => row.snapshotId),
  );
  const clientCitationCount = citationRows.filter((row) => row.isClientOwned).length;
  const sourceHostCount = new Set(citationRows.map((row) => row.sourceName).filter(Boolean)).size;

  const scoreInputs: GeoAeoScoreInputs = {
    brandMentionCoverage: percent(clientMentionSnapshotIds.size, snapshots.length),
    citationCoverage: percent(clientCitationCount, Math.max(snapshots.length, 1)),
    promptIntentCoverage: percent(
      new Set(snapshots.map((snapshot) => snapshot.promptId)).size,
      prompts.length,
    ),
    competitorGapOpportunity: competitorMentionSnapshotIds.size
      ? 100 - percent(clientMentionSnapshotIds.size, competitorMentionSnapshotIds.size)
      : 50,
    entityClarityScore: audit.summary || audit.businessFacts ? 70 : 45,
    schemaReadinessScore: 50,
    sourceAuthorityReadiness: Math.min(100, sourceHostCount * 20),
    accuracyRiskScore: snapshots.some((snapshot) =>
      /incorrect|wrong|outdated|not accurate/i.test(snapshot.answerText),
    )
      ? 50
      : 10,
  };
  const scoreResult = calculateGeoAeoVisibilityScore(scoreInputs);
  const findingRows = buildFindingRows({
    tenantId: params.tenantId,
    auditId: params.auditId,
    userId: params.userId,
    scoreInputs,
    score: scoreResult.score,
    clientMentionCount: clientMentionSnapshotIds.size,
    competitorMentionCount: competitorMentionSnapshotIds.size,
    citationCount: citationRows.length,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(geoAeoMentionsTable)
      .set({ evidenceSnippet: "[superseded by latest analysis]" })
      .where(
        and(
          eq(geoAeoMentionsTable.tenantId, params.tenantId),
          eq(geoAeoMentionsTable.auditId, params.auditId),
        ),
      );

    await tx
      .update(geoAeoFindingsTable)
      .set({ status: "superseded", deletedAt: new Date() })
      .where(
        and(
          eq(geoAeoFindingsTable.tenantId, params.tenantId),
          eq(geoAeoFindingsTable.auditId, params.auditId),
          isNull(geoAeoFindingsTable.deletedAt),
        ),
      );

    if (mentionRows.length > 0) await tx.insert(geoAeoMentionsTable).values(mentionRows);
    if (citationRows.length > 0) await tx.insert(geoAeoCitationsTable).values(citationRows);
    if (findingRows.length > 0) await tx.insert(geoAeoFindingsTable).values(findingRows);

    await tx.insert(geoAeoVisibilityScoresTable).values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      score: scoreResult.score,
      label: scoreResult.label,
      inputs: scoreResult.normalizedInputs,
      explanations: scoreResult.explanations,
      isManualOverride: false,
      createdById: params.userId,
    });

    await tx
      .update(geoAeoAuditsTable)
      .set({
        visibilityScore: scoreResult.score,
        visibilityLabel: scoreResult.label,
        updatedById: params.userId,
      })
      .where(
        and(
          eq(geoAeoAuditsTable.tenantId, params.tenantId),
          eq(geoAeoAuditsTable.id, params.auditId),
        ),
      );
  });

  return {
    score: scoreResult,
    inserted: {
      mentions: mentionRows.length,
      citations: citationRows.length,
      findings: findingRows.length,
    },
  };
}

export async function calculateAndStoreGeoAeoScore(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  inputs: GeoAeoScoreInputs;
  isManualOverride?: boolean;
  overrideScore?: number;
  overrideReason?: string;
}) {
  const scoreResult = calculateGeoAeoVisibilityScore(params.inputs);
  const storedScore = params.overrideScore ?? scoreResult.score;
  const storedLabel =
    params.overrideScore !== undefined
      ? getGeoAeoScoreLabel(params.overrideScore)
      : scoreResult.label;
  const explanations =
    params.overrideScore !== undefined
      ? [`Manual override set the AI Visibility Score to ${params.overrideScore}.`]
      : scoreResult.explanations;

  const [score] = await db
    .insert(geoAeoVisibilityScoresTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      score: storedScore,
      label: storedLabel,
      inputs: scoreResult.normalizedInputs,
      explanations,
      isManualOverride: params.isManualOverride ?? false,
      overrideReason: params.overrideReason ?? null,
      overriddenById: params.isManualOverride ? params.userId : null,
      createdById: params.userId,
    })
    .returning();

  await db
    .update(geoAeoAuditsTable)
    .set({
      visibilityScore: storedScore,
      visibilityLabel: storedLabel,
      updatedById: params.userId,
    })
    .where(
      and(
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.id, params.auditId),
      ),
    );

  return {
    score,
    result: {
      ...scoreResult,
      score: storedScore,
      label: storedLabel,
      explanations,
    },
  };
}

export async function generateGeoAeoActionPlan(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  name: string;
  timeHorizonDays: number;
}) {
  const findings = await listGeoAeoFindings({ tenantId: params.tenantId, auditId: params.auditId });

  return db.transaction(async (tx) => {
    await tx
      .update(geoAeoActionPlansTable)
      .set({ status: "superseded", deletedAt: new Date(), updatedById: params.userId })
      .where(
        and(
          eq(geoAeoActionPlansTable.tenantId, params.tenantId),
          eq(geoAeoActionPlansTable.auditId, params.auditId),
          isNull(geoAeoActionPlansTable.deletedAt),
        ),
      );

    const [plan] = await tx
      .insert(geoAeoActionPlansTable)
      .values({
        tenantId: params.tenantId,
        auditId: params.auditId,
        name: params.name,
        timeHorizonDays: params.timeHorizonDays,
        summary: "Prioritized manual/mock AI visibility actions for the next 30 days.",
        createdById: params.userId,
        updatedById: params.userId,
      })
      .returning();

    const items = buildActionItems({
      tenantId: params.tenantId,
      auditId: params.auditId,
      actionPlanId: plan.id,
      userId: params.userId,
      findings,
    });

    const insertedItems =
      items.length > 0 ? await tx.insert(geoAeoActionItemsTable).values(items).returning() : [];

    return { plan, items: insertedItems };
  });
}

export async function getGeoAeoActionPlan(params: { tenantId: number; auditId: number }) {
  const [plan] = await db
    .select()
    .from(geoAeoActionPlansTable)
    .where(
      and(
        eq(geoAeoActionPlansTable.tenantId, params.tenantId),
        eq(geoAeoActionPlansTable.auditId, params.auditId),
        isNull(geoAeoActionPlansTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoActionPlansTable.createdAt))
    .limit(1);

  if (!plan) return null;

  const items = await db
    .select()
    .from(geoAeoActionItemsTable)
    .where(
      and(
        eq(geoAeoActionItemsTable.tenantId, params.tenantId),
        eq(geoAeoActionItemsTable.actionPlanId, plan.id),
        isNull(geoAeoActionItemsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoActionItemsTable.weekNumber, geoAeoActionItemsTable.createdAt);

  return { plan, items };
}

export async function createGeoAeoActionItem(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  input: GeoAeoActionItemCreateInput;
}) {
  const existingPlan = await getGeoAeoActionPlan({
    tenantId: params.tenantId,
    auditId: params.auditId,
  });
  let plan = existingPlan?.plan;

  if (!plan) {
    [plan] = await db
      .insert(geoAeoActionPlansTable)
      .values({
        tenantId: params.tenantId,
        auditId: params.auditId,
        name: "30-day AI visibility action plan",
        timeHorizonDays: 30,
        summary: "Manual operator-created AI visibility action plan.",
        createdById: params.userId,
        updatedById: params.userId,
      })
      .returning();
  }

  const [item] = await db
    .insert(geoAeoActionItemsTable)
    .values({
      tenantId: params.tenantId,
      auditId: params.auditId,
      actionPlanId: plan.id,
      title: params.input.title,
      description: params.input.description,
      category: params.input.category,
      priority: params.input.priority,
      weekNumber: params.input.weekNumber,
      status: params.input.status,
      createdById: params.userId,
      updatedById: params.userId,
    })
    .returning();

  return { plan, item };
}

export async function listApprovedGeoAeoClientAudits(params: { tenantId: number }) {
  return db
    .select()
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.status, "approved"),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoAuditsTable.approvedAt), desc(geoAeoAuditsTable.createdAt));
}

export async function getApprovedGeoAeoClientAuditDetail(params: {
  tenantId: number;
  auditId: number;
}) {
  const [audit] = await db
    .select()
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.id, params.auditId),
        eq(geoAeoAuditsTable.status, "approved"),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!audit) return null;

  const [findings, actionPlan, reports, monitoringRuns] = await Promise.all([
    db
      .select()
      .from(geoAeoFindingsTable)
      .where(
        and(
          eq(geoAeoFindingsTable.tenantId, params.tenantId),
          eq(geoAeoFindingsTable.auditId, params.auditId),
          eq(geoAeoFindingsTable.status, "approved"),
          isNull(geoAeoFindingsTable.deletedAt),
        ),
      )
      .orderBy(geoAeoFindingsTable.severity, geoAeoFindingsTable.createdAt),
    getApprovedGeoAeoClientActionPlan(params),
    audit.projectId
      ? db
          .select({
            id: reportsTable.id,
            type: reportsTable.type,
            format: reportsTable.format,
            generatedAt: reportsTable.generatedAt,
            createdAt: reportsTable.createdAt,
          })
          .from(reportsTable)
          .where(
            and(
              eq(reportsTable.tenantId, params.tenantId),
              eq(reportsTable.projectId, audit.projectId),
              eq(reportsTable.type, "geo_aeo_visibility_audit"),
            ),
          )
          .orderBy(desc(reportsTable.generatedAt), desc(reportsTable.createdAt))
      : Promise.resolve([]),
    listApprovedGeoAeoMonitoringRuns(params),
  ]);

  return {
    audit,
    findings,
    actionPlan,
    reports,
    monitoringRuns,
  };
}

async function getApprovedGeoAeoClientActionPlan(params: { tenantId: number; auditId: number }) {
  const [plan] = await db
    .select()
    .from(geoAeoActionPlansTable)
    .where(
      and(
        eq(geoAeoActionPlansTable.tenantId, params.tenantId),
        eq(geoAeoActionPlansTable.auditId, params.auditId),
        isNull(geoAeoActionPlansTable.deletedAt),
      ),
    )
    .orderBy(desc(geoAeoActionPlansTable.createdAt))
    .limit(1);

  if (!plan) return null;

  const items = await db
    .select()
    .from(geoAeoActionItemsTable)
    .where(
      and(
        eq(geoAeoActionItemsTable.tenantId, params.tenantId),
        eq(geoAeoActionItemsTable.actionPlanId, plan.id),
        inArray(geoAeoActionItemsTable.status, ["approved", "in_progress", "done"]),
        isNull(geoAeoActionItemsTable.deletedAt),
      ),
    )
    .orderBy(geoAeoActionItemsTable.weekNumber, geoAeoActionItemsTable.createdAt);

  return items.length > 0 ? { plan, items } : null;
}

export async function updateGeoAeoActionItem(params: {
  tenantId: number;
  actionItemId: number;
  userId: number;
  input: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    weekNumber?: number;
    status?: string;
  };
}) {
  const updates: Partial<typeof geoAeoActionItemsTable.$inferInsert> = {
    updatedById: params.userId,
  };

  if (params.input.title !== undefined) updates.title = params.input.title;
  if (params.input.description !== undefined) updates.description = params.input.description;
  if (params.input.category !== undefined) updates.category = params.input.category;
  if (params.input.priority !== undefined) updates.priority = params.input.priority;
  if (params.input.weekNumber !== undefined) updates.weekNumber = params.input.weekNumber;
  if (params.input.status !== undefined) updates.status = params.input.status;

  const [item] = await db
    .update(geoAeoActionItemsTable)
    .set(updates)
    .where(
      and(
        eq(geoAeoActionItemsTable.tenantId, params.tenantId),
        eq(geoAeoActionItemsTable.id, params.actionItemId),
        isNull(geoAeoActionItemsTable.deletedAt),
      ),
    )
    .returning();

  return item ?? null;
}

export async function softDeleteGeoAeoActionItem(params: {
  tenantId: number;
  actionItemId: number;
  userId: number;
}) {
  const [item] = await db
    .update(geoAeoActionItemsTable)
    .set({ deletedAt: new Date(), updatedById: params.userId })
    .where(
      and(
        eq(geoAeoActionItemsTable.tenantId, params.tenantId),
        eq(geoAeoActionItemsTable.id, params.actionItemId),
        isNull(geoAeoActionItemsTable.deletedAt),
      ),
    )
    .returning({ id: geoAeoActionItemsTable.id, auditId: geoAeoActionItemsTable.auditId });

  return item ?? null;
}

export async function generateGeoAeoReport(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  format: GeoAeoReportFormat;
}) {
  const data = await buildGeoAeoReportData({ tenantId: params.tenantId, auditId: params.auditId });
  if (!data) return null;
  if (!data.audit.projectId) {
    return { error: "project_required" as const };
  }

  const [report] = await db
    .insert(reportsTable)
    .values({
      tenantId: params.tenantId,
      projectId: data.audit.projectId,
      type: "geo_aeo_visibility_audit",
      format: params.format,
      generatedAt: new Date(),
      data,
    })
    .returning();

  return { report, data };
}

export async function exportGeoAeoReport(params: {
  tenantId: number;
  reportId: number;
  format: GeoAeoReportFormat;
}) {
  const [report] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.tenantId, params.tenantId),
        eq(reportsTable.id, params.reportId),
        eq(reportsTable.type, "geo_aeo_visibility_audit"),
      ),
    )
    .limit(1);

  if (!report) return null;
  const data = report.data as GeoAeoReportData;
  const body =
    params.format === "json"
      ? JSON.stringify(data, null, 2)
      : params.format === "csv"
        ? geoAeoReportToCsv(data)
        : params.format === "pdf"
          ? geoAeoReportToPdf(data)
          : geoAeoReportToMarkdown(data);

  return {
    body,
    filename: `geo-aeo-report-${report.id}.${params.format === "markdown" ? "md" : params.format}`,
    contentType:
      params.format === "json"
        ? "application/json"
        : params.format === "csv"
          ? "text/csv"
          : params.format === "pdf"
            ? "application/pdf"
            : "text/markdown",
    report,
  };
}

interface GeoAeoReportData {
  generatedAt: string;
  audit: {
    id: number;
    name: string;
    websiteUrl: string;
    niche: string;
    projectId: number | null;
    visibilityScore: number | null;
    visibilityLabel: string | null;
  };
  summary: {
    promptCount: number;
    snapshotCount: number;
    findingCount: number;
    actionItemCount: number;
  };
  prompts?: Awaited<ReturnType<typeof listGeoAeoPrompts>>;
  snapshots?: Awaited<ReturnType<typeof listGeoAeoAnswerSnapshots>>;
  findings: Awaited<ReturnType<typeof listGeoAeoFindings>>;
  actionPlan: Awaited<ReturnType<typeof getGeoAeoActionPlan>>;
  methodology?: typeof GEO_AEO_REPORT_METHODOLOGY;
}

async function buildGeoAeoReportData(params: {
  tenantId: number;
  auditId: number;
}): Promise<GeoAeoReportData | null> {
  const [audit] = await db
    .select()
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.id, params.auditId),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!audit) return null;

  const [prompts, snapshots, findings, actionPlan] = await Promise.all([
    listGeoAeoPrompts({ tenantId: params.tenantId, auditId: params.auditId }),
    listGeoAeoAnswerSnapshots({ tenantId: params.tenantId, auditId: params.auditId }),
    listGeoAeoFindings({ tenantId: params.tenantId, auditId: params.auditId }),
    getGeoAeoActionPlan({ tenantId: params.tenantId, auditId: params.auditId }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    audit: {
      id: audit.id,
      name: audit.auditName,
      websiteUrl: audit.websiteUrl,
      niche: audit.niche,
      projectId: audit.projectId,
      visibilityScore: audit.visibilityScore,
      visibilityLabel: audit.visibilityLabel,
    },
    summary: {
      promptCount: prompts.length,
      snapshotCount: snapshots.length,
      findingCount: findings.length,
      actionItemCount: actionPlan?.items.length ?? 0,
    },
    prompts,
    snapshots,
    findings,
    actionPlan,
    methodology: GEO_AEO_REPORT_METHODOLOGY,
  };
}

function geoAeoReportToMarkdown(data: GeoAeoReportData): string {
  const findings = data.findings
    .map(
      (findingRecord) =>
        `- **${findingRecord.severity}** ${findingRecord.title}: ${findingRecord.recommendation ?? ""}`,
    )
    .join("\n");
  const actionItems =
    data.actionPlan?.items
      .map((item) => `- Week ${item.weekNumber}: ${item.title} (${item.status})`)
      .join("\n") ?? "- No action plan generated yet.";
  const promptMatrix = geoAeoPromptMatrixRows(data)
    .map(
      (row) =>
        `- ${row.promptText} - ${row.engines || "No snapshots"}; mentioned ${row.clientMentionedCount}/${row.snapshotCount}; cited ${row.clientCitedCount}/${row.snapshotCount}.`,
    )
    .join("\n");
  const snapshotEvidence = (data.snapshots ?? [])
    .slice(0, 20)
    .map(
      (snapshot) =>
        `- ${snapshot.engine} prompt ${snapshot.promptId}: ${snapshot.clientMentioned ? "mentioned" : "not mentioned"}, ${snapshot.clientCited ? "cited" : "not cited"} (${snapshot.captureMethod})`,
    )
    .join("\n");
  const methodology = data.methodology ?? GEO_AEO_REPORT_METHODOLOGY;

  return [
    `# ${data.audit.name} GEO/AEO Visibility Audit`,
    "",
    `Generated: ${data.generatedAt}`,
    `Website: ${data.audit.websiteUrl}`,
    `AI Visibility Score: ${data.audit.visibilityScore ?? "Not scored"} ${data.audit.visibilityLabel ?? ""}`,
    "",
    "## Executive Summary",
    `Prompts: ${data.summary.promptCount}; snapshots: ${data.summary.snapshotCount}; findings: ${data.summary.findingCount}.`,
    "",
    "## AI Visibility Scorecard",
    `Score: ${data.audit.visibilityScore ?? "Not scored"} ${data.audit.visibilityLabel ?? ""}`,
    "",
    "## Prompt Matrix",
    promptMatrix || "- No prompts captured yet.",
    "",
    "## Answer Snapshot Evidence",
    snapshotEvidence || "- No answer snapshots captured yet.",
    "",
    "## Findings",
    findings || "- No findings generated yet.",
    "",
    "## 30-Day Action Plan",
    actionItems,
    "",
    "## Methodology and Limitations",
    ...methodology.dataSources.map((source) => `- Data source: ${source}`),
    ...methodology.limitations.map((limitation) => `- Limitation: ${limitation}`),
  ].join("\n");
}

function geoAeoReportToCsv(data: GeoAeoReportData): string {
  const methodology = data.methodology ?? GEO_AEO_REPORT_METHODOLOGY;
  const rows = [
    ["section", "title", "status", "detail"],
    [
      "summary",
      "AI Visibility Score",
      data.audit.visibilityLabel ?? "",
      String(data.audit.visibilityScore ?? ""),
    ],
    ...geoAeoPromptMatrixRows(data).map((row) => [
      "prompt_matrix",
      row.promptText,
      row.status,
      `intent=${row.intent}; funnel=${row.funnelStage}; service=${row.serviceOrProduct}; location=${row.location}; snapshots=${row.snapshotCount}; engines=${row.engines}; mentioned=${row.clientMentionedCount}; cited=${row.clientCitedCount}`,
    ]),
    ...(data.snapshots ?? []).map((snapshot) => [
      "answer_snapshot",
      `${snapshot.engine} prompt ${snapshot.promptId}`,
      snapshot.clientMentioned ? "mentioned" : "not_mentioned",
      `${snapshot.answerText}; ${snapshot.clientCited ? "cited" : "not_cited"}; ${snapshot.captureMethod}`,
    ]),
    ...data.findings.map((findingRecord) => [
      "finding",
      findingRecord.title,
      findingRecord.status,
      findingRecord.recommendation ?? "",
    ]),
    ...(data.actionPlan?.items.map((item) => [
      "action_item",
      item.title,
      item.status,
      `week ${item.weekNumber}: ${item.description ?? ""}`,
    ]) ?? []),
    ...methodology.dataSources.map((source) => ["methodology", "Data source", "", source]),
    ...methodology.limitations.map((limitation) => ["limitations", "Limitation", "", limitation]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function geoAeoPromptMatrixRows(data: GeoAeoReportData) {
  const snapshotsByPromptId = new Map<number, NonNullable<GeoAeoReportData["snapshots"]>>();
  for (const snapshot of data.snapshots ?? []) {
    const existing = snapshotsByPromptId.get(snapshot.promptId) ?? [];
    existing.push(snapshot);
    snapshotsByPromptId.set(snapshot.promptId, existing);
  }

  return (data.prompts ?? []).map((prompt) => {
    const promptSnapshots = snapshotsByPromptId.get(prompt.id) ?? [];
    const engines = Array.from(new Set(promptSnapshots.map((snapshot) => snapshot.engine))).join(
      ", ",
    );

    return {
      promptText: prompt.promptText,
      status: prompt.status,
      intent: prompt.intent ?? "",
      funnelStage: prompt.funnelStage ?? "",
      serviceOrProduct: prompt.serviceOrProduct ?? "",
      location: prompt.location ?? "",
      snapshotCount: promptSnapshots.length,
      engines,
      clientMentionedCount: promptSnapshots.filter((snapshot) => snapshot.clientMentioned).length,
      clientCitedCount: promptSnapshots.filter((snapshot) => snapshot.clientCited).length,
    };
  });
}

function geoAeoReportToPdf(data: GeoAeoReportData): string {
  const lines = wrapPdfText(markdownToPdfText(geoAeoReportToMarkdown(data)), 92);
  const pageLineCount = 58;
  const pages = chunkArray(lines, pageLineCount);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  const fontObjectId = 3;
  let nextObjectId = 4;

  objects[catalogObjectId] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (const pageLines of pages.length ? pages : [["No report content available."]]) {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    const stream = buildPdfContentStream(pageLines);
    objects[pageObjectId] = [
      "<< /Type /Page",
      "/Parent 2 0 R",
      "/MediaBox [0 0 612 792]",
      "/Resources << /Font << /F1 3 0 R >> >>",
      `/Contents ${contentObjectId} 0 R`,
      ">>",
    ].join(" ");
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
  }

  objects[pagesObjectId] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  return buildPdfDocument(objects);
}

function markdownToPdfText(markdown: string): string {
  return markdown
    .replace(/\*\*/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "  - "))
    .join("\n");
}

function wrapPdfText(text: string, width: number): string[] {
  return text.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [""];
    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > width && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) wrapped.push(current);
    return wrapped;
  });
}

function buildPdfContentStream(lines: string[]): string {
  const commands = ["BT", "/F1 10 Tf", "50 750 Td", "12 TL"];
  for (const line of lines) {
    commands.push(`(${escapePdfText(line)}) Tj`, "T*");
  }
  commands.push("ET");
  return commands.join("\n");
}

function escapePdfText(value: string): string {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code <= 126 ? character : " ";
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfDocument(objects: string[]): string {
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(chunks.join(""), "ascii");
    chunks.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "ascii");
  chunks.push(`xref\n0 ${objects.length}\n`);
  chunks.push("0000000000 65535 f \n");
  for (let id = 1; id < objects.length; id += 1) {
    chunks.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`);
  chunks.push(`startxref\n${xrefOffset}\n%%EOF`);

  return chunks.join("");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function csvCell(value: string): string {
  const neutralizedValue = neutralizeCsvCell(value);
  return /[",\n\r]/.test(neutralizedValue)
    ? `"${neutralizedValue.replace(/"/g, '""')}"`
    : neutralizedValue;
}

function toAnswerSnapshotInsert(
  tenantId: number,
  userId: number,
  input: GeoAeoSnapshotCreateInput,
  importBatchId?: number,
): typeof geoAeoAnswerSnapshotsTable.$inferInsert {
  return {
    tenantId,
    auditId: input.auditId,
    promptId: input.promptId,
    promptVariantId: input.promptVariantId ?? null,
    importBatchId: importBatchId ?? null,
    engine: input.engine,
    engineMode: input.captureMethod === "csv_import" ? "consumer_manual" : "consumer_manual",
    captureMethod: input.captureMethod,
    answerText: input.answerText,
    answerHash: createAnswerHash(input.answerText),
    locationContext: input.locationContext ?? null,
    capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
    createdById: userId,
  };
}

function createAnswerHash(answerText: string): string {
  return createHash("sha256").update(answerText).digest("hex");
}

function snapshotDuplicateKey(promptId: number, engine: string, answerHash: string): string {
  return `${promptId}:${engine}:${answerHash}`;
}

function normalizePrompt(promptText: string): string {
  return promptText.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalPositiveInteger(value: string | undefined): number | null | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalIntegerInRange(
  value: string | undefined,
  min: number,
  max: number,
): number | null | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function buildFindingRows(params: {
  tenantId: number;
  auditId: number;
  userId: number;
  scoreInputs: GeoAeoScoreInputs;
  score: number;
  clientMentionCount: number;
  competitorMentionCount: number;
  citationCount: number;
}): (typeof geoAeoFindingsTable.$inferInsert)[] {
  const rows: (typeof geoAeoFindingsTable.$inferInsert)[] = [];

  if ((params.scoreInputs.brandMentionCoverage ?? 0) < 60) {
    rows.push(
      finding(
        params,
        "brand_not_mentioned",
        "high",
        "Brand is underrepresented in answer snapshots",
        "Increase AI-citable brand/entity clarity across priority pages and sources.",
      ),
    );
  }

  if ((params.scoreInputs.citationCoverage ?? 0) < 50) {
    rows.push(
      finding(
        params,
        "brand_not_cited",
        "high",
        "Client-owned sources are rarely cited",
        "Strengthen authoritative source pages and ensure service pages answer target questions directly.",
      ),
    );
  }

  if (params.competitorMentionCount > params.clientMentionCount) {
    rows.push(
      finding(
        params,
        "competitor_dominates",
        "medium",
        "Competitors appear more often than the client",
        "Create comparison, proof, and service pages that answer the questions where competitors currently appear.",
      ),
    );
  }

  if (params.citationCount === 0) {
    rows.push(
      finding(
        params,
        "source_gap",
        "medium",
        "No citation URLs were found in snapshots",
        "Add source tracking and improve pages likely to be used as AI answer citations.",
      ),
    );
  }

  if (params.score < 60) {
    rows.push(
      finding(
        params,
        "entity_clarity_gap",
        "medium",
        "AI visibility score indicates entity clarity risk",
        "Clarify who the business serves, where it operates, and what proof supports recommendations.",
      ),
    );
  }

  return rows;
}

function finding(
  params: { tenantId: number; auditId: number; userId: number },
  findingType: string,
  severity: string,
  title: string,
  recommendation: string,
): typeof geoAeoFindingsTable.$inferInsert {
  return {
    tenantId: params.tenantId,
    auditId: params.auditId,
    findingType,
    severity,
    title,
    recommendation,
    status: "draft",
    createdById: params.userId,
    updatedById: params.userId,
  };
}

function extractBrandTerms(websiteUrl: string, auditName: string): string[] {
  return [auditName, hostWithoutWww(websiteUrl)].filter((term) => term.length > 0);
}

function hostWithoutWww(value: string): string {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return (
      value
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? value
    );
  }
}

function includesAny(value: string, terms: string[]): boolean {
  const haystack = value.toLowerCase();
  return terms.some((term) => term.trim() && haystack.includes(term.toLowerCase()));
}

function snippetAround(value: string, terms: string[]): string {
  const lower = value.toLowerCase();
  const term = terms.find((candidate) => lower.includes(candidate.toLowerCase()));
  if (!term) return value.slice(0, 240);
  const index = lower.indexOf(term.toLowerCase());
  const start = Math.max(0, index - 80);
  return value.slice(start, start + 240);
}

function extractUrls(value: string): string[] {
  return Array.from(new Set(value.match(/https?:\/\/[^\s),\]]+/g) ?? []));
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function calculateMonitoringScoreDelta(
  baselineScore: number | null | undefined,
  currentScore: number | null | undefined,
): number | null {
  if (baselineScore === null || baselineScore === undefined) return null;
  if (currentScore === null || currentScore === undefined) return null;
  return Math.round((currentScore - baselineScore) * 100) / 100;
}

function buildActionItems(params: {
  tenantId: number;
  auditId: number;
  actionPlanId: number;
  userId: number;
  findings: Awaited<ReturnType<typeof listGeoAeoFindings>>;
}): (typeof geoAeoActionItemsTable.$inferInsert)[] {
  const rows = params.findings.slice(0, 12).map((findingRecord, index) => ({
    tenantId: params.tenantId,
    auditId: params.auditId,
    actionPlanId: params.actionPlanId,
    title: `Resolve: ${findingRecord.title}`,
    description: findingRecord.recommendation ?? findingRecord.description ?? "",
    category: categoryForFinding(findingRecord.findingType),
    priority: findingRecord.severity,
    weekNumber: Math.min(4, Math.floor(index / 3) + 1),
    ownerRole: "operator",
    status: "draft",
    relatedFindingId: findingRecord.id,
    createdById: params.userId,
    updatedById: params.userId,
  }));

  if (rows.length > 0) return rows;

  return [
    {
      tenantId: params.tenantId,
      auditId: params.auditId,
      actionPlanId: params.actionPlanId,
      title: "Review AI visibility snapshots and identify source gaps",
      description:
        "Use manual snapshots to confirm where the client is mentioned, cited, or missing.",
      category: "measurement",
      priority: "medium",
      weekNumber: 1,
      ownerRole: "operator",
      status: "draft",
      createdById: params.userId,
      updatedById: params.userId,
    },
  ];
}

function categoryForFinding(findingType: string): string {
  if (findingType.includes("schema") || findingType.includes("faq")) return "faq_schema";
  if (findingType.includes("source") || findingType.includes("cited")) return "source_citation";
  if (findingType.includes("competitor")) return "competitor_gap";
  if (findingType.includes("service")) return "service_page";
  return "entity_clarity";
}
