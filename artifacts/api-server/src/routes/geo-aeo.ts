import { Router } from "express";
import { z } from "zod";
import {
  geoAeoAuditCreateSchema,
  geoAeoAuditUpdateSchema,
  geoAeoActionItemCreateSchema,
  geoAeoActionItemUpdateSchema,
  geoAeoActionPlanGenerateSchema,
  geoAeoCitationCreateSchema,
  geoAeoCompetitorCreateSchema,
  geoAeoCompetitorUpdateSchema,
  geoAeoPromptCreateSchema,
  geoAeoPromptImportCsvSchema,
  geoAeoFindingUpdateSchema,
  geoAeoMonitoringRunCreateSchema,
  geoAeoMonitoringRunUpdateSchema,
  geoAeoReportExportSchema,
  geoAeoReportGenerateSchema,
  geoAeoSchemaFindingCreateSchema,
  geoAeoSchemaFindingUpdateSchema,
  geoAeoScoreInputsSchema,
  geoAeoScoreOverrideSchema,
  geoAeoSnapshotUpdateSchema,
  geoAeoSnapshotCreateSchema,
  geoAeoSnapshotImportCsvSchema,
  geoAeoSourceRecommendationCreateSchema,
  geoAeoSourceRecommendationUpdateSchema,
} from "@workspace/shared/geo-aeo";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  assertTenantScopedClient,
  assertTenantScopedProject,
  auditGeoAeoEvent,
  GEO_AEO_APPROVER_ROLES,
  GEO_AEO_OPERATOR_ROLES,
  GEO_AEO_VIEW_ROLES,
  getTenantScopedGeoAeoPrompt,
  getTenantScopedGeoAeoAudit,
  getTenantScopedGeoAeoFinding,
} from "../lib/geo-aeo-access.js";
import {
  analyzeGeoAeoAudit,
  calculateAndStoreGeoAeoScore,
  generateGeoAeoActionPlan,
  generateGeoAeoReport,
  getGeoAeoActionPlan,
  getApprovedGeoAeoClientAuditDetail,
  createGeoAeoCitation,
  createGeoAeoCompetitor,
  createGeoAeoSchemaFinding,
  createGeoAeoSourceRecommendation,
  createGeoAeoMonitoringRun,
  createGeoAeoAnswerSnapshot,
  createGeoAeoAnswerSnapshots,
  createGeoAeoAudit,
  createGeoAeoActionItem,
  createGeoAeoPrompt,
  createGeoAeoPrompts,
  listApprovedGeoAeoClientAudits,
  listApprovedGeoAeoMonitoringRuns,
  listGeoAeoAnswerSnapshots,
  listGeoAeoAudits,
  listGeoAeoCitations,
  listGeoAeoCompetitors,
  listGeoAeoFindings,
  listGeoAeoMonitoringRuns,
  listGeoAeoPrompts,
  listGeoAeoSchemaFindings,
  listGeoAeoSourceRecommendations,
  parseGeoAeoPromptCsv,
  parseGeoAeoSnapshotCsv,
  previewGeoAeoPromptCsv,
  previewGeoAeoSnapshotCsv,
  softDeleteGeoAeoActionItem,
  softDeleteGeoAeoCitation,
  softDeleteGeoAeoCompetitor,
  softDeleteGeoAeoSchemaFinding,
  softDeleteGeoAeoSourceRecommendation,
  softDeleteGeoAeoAudit,
  updateGeoAeoAnswerSnapshot,
  updateGeoAeoAudit,
  updateGeoAeoActionItem,
  updateGeoAeoCompetitor,
  updateGeoAeoFinding,
  updateGeoAeoMonitoringRun,
  updateGeoAeoSchemaFinding,
  updateGeoAeoSourceRecommendation,
  exportGeoAeoReport,
} from "../lib/geo-aeo-service.js";

const router = Router();

const ListAuditsQuery = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  status: z.string().trim().min(1).max(80).optional(),
});

function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

router.get(
  "/geo-aeo/audits",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const parsed = ListAuditsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const audits = await listGeoAeoAudits({
      tenantId,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      status: parsed.data.status,
    });

    res.json(audits);
  },
);

router.get(
  "/geo-aeo/client/audits",
  requireAuth,
  requireRole(GEO_AEO_VIEW_ROLES),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const audits = await listApprovedGeoAeoClientAudits({ tenantId });
    res.json(audits);
  },
);

router.get(
  "/geo-aeo/client/audits/:auditId",
  requireAuth,
  requireRole(GEO_AEO_VIEW_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    const detail = await getApprovedGeoAeoClientAuditDetail({ tenantId, auditId });
    if (!detail) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(detail);
  },
);

router.get(
  "/geo-aeo/client/audits/:auditId/monitoring-runs",
  requireAuth,
  requireRole(GEO_AEO_VIEW_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    const detail = await getApprovedGeoAeoClientAuditDetail({ tenantId, auditId });
    if (!detail) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listApprovedGeoAeoMonitoringRuns({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const parsed = geoAeoAuditCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;

    if (!(await assertTenantScopedClient(parsed.data.clientId, tenantId))) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    if (
      parsed.data.projectId !== undefined &&
      !(await assertTenantScopedProject(parsed.data.projectId, tenantId, parsed.data.clientId))
    ) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const audit = await createGeoAeoAudit({ tenantId, userId, input: parsed.data });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.audit.created",
      resourceType: "geo_aeo_audit",
      resourceId: audit.id,
      metadata: { clientId: audit.clientId, projectId: audit.projectId },
      req,
    });

    res.status(201).json(audit);
  },
);

router.get(
  "/geo-aeo/audits/:auditId/prompts",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const prompts = await listGeoAeoPrompts({ tenantId, auditId });
    res.json(prompts);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/prompts",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoPromptCreateSchema.safeParse({ ...req.body, auditId });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const prompt = await createGeoAeoPrompt({ tenantId, userId, input: parsed.data });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.prompt.created",
      resourceType: "geo_aeo_prompt",
      resourceId: prompt.id,
      metadata: { auditId },
      req,
    });

    res.status(201).json(prompt);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/prompts/import/preview",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoPromptImportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const preview = await previewGeoAeoPromptCsv({
      tenantId,
      auditId,
      csvText: parsed.data.csvText,
    });
    res.json(preview);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/prompts/import",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoPromptImportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const preview = await previewGeoAeoPromptCsv({
      tenantId,
      auditId,
      csvText: parsed.data.csvText,
    });
    if (preview.invalidRows > 0 || preview.duplicateRows > 0) {
      res.status(400).json({
        error: "Invalid CSV",
        details: [...preview.invalid, ...preview.duplicates].map(
          (issue) => `Row ${issue.row}: ${issue.reason}`,
        ),
        preview,
      });
      return;
    }

    const importResult = parseGeoAeoPromptCsv(parsed.data.csvText, auditId);
    if (importResult.errors.length > 0) {
      res.status(400).json({ error: "Invalid CSV", details: importResult.errors });
      return;
    }

    const prompts = await createGeoAeoPrompts({
      tenantId,
      userId,
      prompts: importResult.prompts,
    });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.prompt.imported",
      resourceType: "geo_aeo_audit",
      resourceId: auditId,
      metadata: { imported: prompts.length },
      req,
    });

    res.status(201).json({ imported: prompts.length, prompts });
  },
);

router.get(
  "/geo-aeo/audits/:auditId/snapshots",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const snapshots = await listGeoAeoAnswerSnapshots({ tenantId, auditId });
    res.json(snapshots);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/snapshots",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoSnapshotCreateSchema.safeParse({ ...req.body, auditId });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    if (!(await getTenantScopedGeoAeoPrompt(parsed.data.promptId, tenantId, auditId))) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }

    const snapshot = await createGeoAeoAnswerSnapshot({ tenantId, userId, input: parsed.data });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.snapshot.created",
      resourceType: "geo_aeo_answer_snapshot",
      resourceId: snapshot.id,
      metadata: { auditId, promptId: snapshot.promptId, engine: snapshot.engine },
      req,
    });

    res.status(201).json(snapshot);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/snapshots/import-csv/preview",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoSnapshotImportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const preview = await previewGeoAeoSnapshotCsv({
      tenantId,
      auditId,
      csvText: parsed.data.csvText,
    });
    res.json(preview);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/snapshots/import-csv",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoSnapshotImportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const preview = await previewGeoAeoSnapshotCsv({
      tenantId,
      auditId,
      csvText: parsed.data.csvText,
    });
    if (preview.invalidRows > 0 || preview.duplicateRows > 0) {
      res.status(400).json({
        error: "Invalid CSV",
        details: [...preview.invalid, ...preview.duplicates].map(
          (issue) => `Row ${issue.row}: ${issue.reason}`,
        ),
        preview,
      });
      return;
    }

    const importResult = parseGeoAeoSnapshotCsv(parsed.data.csvText, auditId);
    if (importResult.errors.length > 0) {
      res.status(400).json({ error: "Invalid CSV", details: importResult.errors });
      return;
    }

    const promptIds = Array.from(new Set(importResult.snapshots.map((snapshot) => snapshot.promptId)));
    for (const promptId of promptIds) {
      if (!(await getTenantScopedGeoAeoPrompt(promptId, tenantId, auditId))) {
        res.status(404).json({ error: "Prompt not found", promptId });
        return;
      }
    }

    const snapshots = await createGeoAeoAnswerSnapshots({
      tenantId,
      userId,
      snapshots: importResult.snapshots,
    });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.snapshot.imported",
      resourceType: "geo_aeo_audit",
      resourceId: auditId,
      metadata: { imported: snapshots.length },
      req,
    });

    res.status(201).json({ imported: snapshots.length, snapshots });
  },
);

router.patch(
  "/geo-aeo/snapshots/:snapshotId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const snapshotId = parseId(req.params.snapshotId);
    if (snapshotId === null) {
      res.status(400).json({ error: "Invalid snapshotId" });
      return;
    }

    const parsed = geoAeoSnapshotUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const snapshot = await updateGeoAeoAnswerSnapshot({
      tenantId,
      snapshotId,
      input: parsed.data,
    });
    if (!snapshot) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.snapshot.updated",
      resourceType: "geo_aeo_answer_snapshot",
      resourceId: snapshot.id,
      metadata: { auditId: snapshot.auditId },
      req,
    });

    res.json(snapshot);
  },
);

router.get(
  "/geo-aeo/audits/:auditId/competitors",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listGeoAeoCompetitors({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits/:auditId/competitors",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoCompetitorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const competitor = await createGeoAeoCompetitor({ tenantId, auditId, userId, input: parsed.data });
    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.competitor.created",
      resourceType: "geo_aeo_competitor",
      resourceId: competitor.id,
      metadata: { auditId },
      req,
    });

    res.status(201).json(competitor);
  },
);

router.patch(
  "/geo-aeo/competitors/:competitorId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const competitorId = parseId(req.params.competitorId);
    if (competitorId === null) {
      res.status(400).json({ error: "Invalid competitorId" });
      return;
    }

    const parsed = geoAeoCompetitorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const competitor = await updateGeoAeoCompetitor({ tenantId, competitorId, input: parsed.data });
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.competitor.updated",
      resourceType: "geo_aeo_competitor",
      resourceId: competitor.id,
      metadata: { auditId: competitor.auditId },
      req,
    });

    res.json(competitor);
  },
);

router.delete(
  "/geo-aeo/competitors/:competitorId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const competitorId = parseId(req.params.competitorId);
    if (competitorId === null) {
      res.status(400).json({ error: "Invalid competitorId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const competitor = await softDeleteGeoAeoCompetitor({ tenantId, competitorId, userId });
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.competitor.deleted",
      resourceType: "geo_aeo_competitor",
      resourceId: competitor.id,
      metadata: { auditId: competitor.auditId },
      req,
    });

    res.status(204).send();
  },
);

router.get(
  "/geo-aeo/audits/:auditId/citations",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listGeoAeoCitations({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits/:auditId/citations",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoCitationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const citation = await createGeoAeoCitation({ tenantId, auditId, userId, input: parsed.data });
    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.citation.created",
      resourceType: "geo_aeo_citation",
      resourceId: citation.id,
      metadata: { auditId },
      req,
    });

    res.status(201).json(citation);
  },
);

router.delete(
  "/geo-aeo/citations/:citationId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const citationId = parseId(req.params.citationId);
    if (citationId === null) {
      res.status(400).json({ error: "Invalid citationId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const citation = await softDeleteGeoAeoCitation({ tenantId, citationId });
    if (!citation) {
      res.status(404).json({ error: "Citation not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.citation.deleted",
      resourceType: "geo_aeo_citation",
      resourceId: citation.id,
      metadata: { auditId: citation.auditId },
      req,
    });

    res.status(204).send();
  },
);

router.get(
  "/geo-aeo/audits/:auditId/source-recommendations",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listGeoAeoSourceRecommendations({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits/:auditId/source-recommendations",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoSourceRecommendationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const recommendation = await createGeoAeoSourceRecommendation({
      tenantId,
      auditId,
      userId,
      input: parsed.data,
    });
    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.source_recommendation.created",
      resourceType: "geo_aeo_source_recommendation",
      resourceId: recommendation.id,
      metadata: { auditId },
      req,
    });

    res.status(201).json(recommendation);
  },
);

router.patch(
  "/geo-aeo/source-recommendations/:sourceRecommendationId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const sourceRecommendationId = parseId(req.params.sourceRecommendationId);
    if (sourceRecommendationId === null) {
      res.status(400).json({ error: "Invalid sourceRecommendationId" });
      return;
    }

    const parsed = geoAeoSourceRecommendationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const recommendation = await updateGeoAeoSourceRecommendation({
      tenantId,
      sourceRecommendationId,
      userId,
      input: parsed.data,
    });
    if (!recommendation) {
      res.status(404).json({ error: "Source recommendation not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.source_recommendation.updated",
      resourceType: "geo_aeo_source_recommendation",
      resourceId: recommendation.id,
      metadata: { auditId: recommendation.auditId },
      req,
    });

    res.json(recommendation);
  },
);

router.delete(
  "/geo-aeo/source-recommendations/:sourceRecommendationId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const sourceRecommendationId = parseId(req.params.sourceRecommendationId);
    if (sourceRecommendationId === null) {
      res.status(400).json({ error: "Invalid sourceRecommendationId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const recommendation = await softDeleteGeoAeoSourceRecommendation({
      tenantId,
      sourceRecommendationId,
      userId,
    });
    if (!recommendation) {
      res.status(404).json({ error: "Source recommendation not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.source_recommendation.deleted",
      resourceType: "geo_aeo_source_recommendation",
      resourceId: recommendation.id,
      metadata: { auditId: recommendation.auditId },
      req,
    });

    res.status(204).send();
  },
);

router.get(
  "/geo-aeo/audits/:auditId/schema-findings",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listGeoAeoSchemaFindings({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits/:auditId/schema-findings",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoSchemaFindingCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const schemaFinding = await createGeoAeoSchemaFinding({
      tenantId,
      auditId,
      userId,
      input: parsed.data,
    });
    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.schema_finding.created",
      resourceType: "geo_aeo_schema_finding",
      resourceId: schemaFinding.id,
      metadata: { auditId },
      req,
    });

    res.status(201).json(schemaFinding);
  },
);

router.patch(
  "/geo-aeo/schema-findings/:schemaFindingId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const schemaFindingId = parseId(req.params.schemaFindingId);
    if (schemaFindingId === null) {
      res.status(400).json({ error: "Invalid schemaFindingId" });
      return;
    }

    const parsed = geoAeoSchemaFindingUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const schemaFinding = await updateGeoAeoSchemaFinding({
      tenantId,
      schemaFindingId,
      userId,
      input: parsed.data,
    });
    if (!schemaFinding) {
      res.status(404).json({ error: "Schema finding not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.schema_finding.updated",
      resourceType: "geo_aeo_schema_finding",
      resourceId: schemaFinding.id,
      metadata: { auditId: schemaFinding.auditId },
      req,
    });

    res.json(schemaFinding);
  },
);

router.delete(
  "/geo-aeo/schema-findings/:schemaFindingId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const schemaFindingId = parseId(req.params.schemaFindingId);
    if (schemaFindingId === null) {
      res.status(400).json({ error: "Invalid schemaFindingId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const schemaFinding = await softDeleteGeoAeoSchemaFinding({
      tenantId,
      schemaFindingId,
      userId,
    });
    if (!schemaFinding) {
      res.status(404).json({ error: "Schema finding not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.schema_finding.deleted",
      resourceType: "geo_aeo_schema_finding",
      resourceId: schemaFinding.id,
      metadata: { auditId: schemaFinding.auditId },
      req,
    });

    res.status(204).send();
  },
);

router.get(
  "/geo-aeo/audits/:auditId/monitoring-runs",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(await listGeoAeoMonitoringRuns({ tenantId, auditId }));
  },
);

router.post(
  "/geo-aeo/audits/:auditId/monitoring-runs",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoMonitoringRunCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const run = await createGeoAeoMonitoringRun({
      tenantId,
      auditId,
      userId,
      input: parsed.data,
    });
    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.monitoring_run.created",
      resourceType: "geo_aeo_monitoring_run",
      resourceId: run.id,
      metadata: { auditId, runMonth: run.runMonth },
      req,
    });

    res.status(201).json(run);
  },
);

router.patch(
  "/geo-aeo/monitoring-runs/:monitoringRunId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const monitoringRunId = parseId(req.params.monitoringRunId);
    if (monitoringRunId === null) {
      res.status(400).json({ error: "Invalid monitoringRunId" });
      return;
    }

    const parsed = geoAeoMonitoringRunUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const run = await updateGeoAeoMonitoringRun({
      tenantId,
      monitoringRunId,
      userId,
      input: parsed.data,
    });
    if (!run) {
      res.status(404).json({ error: "Monitoring run not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action:
        parsed.data.status === "approved"
          ? "geo_aeo.monitoring_run.approved"
          : "geo_aeo.monitoring_run.updated",
      resourceType: "geo_aeo_monitoring_run",
      resourceId: run.id,
      metadata: { auditId: run.auditId, runMonth: run.runMonth },
      req,
    });

    res.json(run);
  },
);

router.post(
  "/geo-aeo/monitoring-runs/:monitoringRunId/approve",
  requireAuth,
  requireRole(GEO_AEO_APPROVER_ROLES),
  async (req, res): Promise<void> => {
    const monitoringRunId = parseId(req.params.monitoringRunId);
    if (monitoringRunId === null) {
      res.status(400).json({ error: "Invalid monitoringRunId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const run = await updateGeoAeoMonitoringRun({
      tenantId,
      monitoringRunId,
      userId,
      input: { status: "approved" },
    });
    if (!run) {
      res.status(404).json({ error: "Monitoring run not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.monitoring_run.approved",
      resourceType: "geo_aeo_monitoring_run",
      resourceId: run.id,
      metadata: { auditId: run.auditId, runMonth: run.runMonth },
      req,
    });

    res.json(run);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/analyze",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.analysis.started",
      resourceType: "geo_aeo_audit",
      resourceId: auditId,
      req,
    });

    const result = await analyzeGeoAeoAudit({ tenantId, auditId, userId });
    if (!result) {
      await auditGeoAeoEvent({
        tenantId,
        userId,
        action: "geo_aeo.analysis.failed",
        resourceType: "geo_aeo_audit",
        resourceId: auditId,
        metadata: { reason: "audit_not_found" },
        req,
      });
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.analysis.completed",
      resourceType: "geo_aeo_audit",
      resourceId: auditId,
      metadata: result.inserted,
      req,
    });

    res.json(result);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/score",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoScoreInputsSchema.safeParse(req.body);
    const override = geoAeoScoreOverrideSchema.safeParse(req.body);
    if (!parsed.success && !override.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const inputs = override.success ? {} : parsed.data;
    if (inputs === undefined) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const stored = await calculateAndStoreGeoAeoScore({
      tenantId,
      auditId,
      userId,
      inputs,
      isManualOverride: override.success,
      overrideScore: override.success ? override.data.score : undefined,
      overrideReason: override.success ? override.data.reason : undefined,
    });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: override.success ? "geo_aeo.score.overridden" : "geo_aeo.score.calculated",
      resourceType: "geo_aeo_visibility_score",
      resourceId: stored.score.id,
      metadata: { auditId, score: stored.result.score },
      req,
    });

    res.status(201).json(stored);
  },
);

router.get(
  "/geo-aeo/audits/:auditId/findings",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const findings = await listGeoAeoFindings({ tenantId, auditId });
    res.json(findings);
  },
);

router.patch(
  "/geo-aeo/findings/:findingId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const findingId = parseId(req.params.findingId);
    if (findingId === null) {
      res.status(400).json({ error: "Invalid findingId" });
      return;
    }

    const parsed = geoAeoFindingUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const existing = await getTenantScopedGeoAeoFinding(findingId, tenantId);
    if (!existing) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    if (parsed.data.status === "approved" && !GEO_AEO_APPROVER_ROLES.includes(req.session.user!.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const finding = await updateGeoAeoFinding({
      tenantId,
      findingId,
      userId,
      input: parsed.data,
    });
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: parsed.data.status === "approved" ? "geo_aeo.finding.approved" : "geo_aeo.finding.updated",
      resourceType: "geo_aeo_finding",
      resourceId: finding.id,
      metadata: { auditId: finding.auditId, status: finding.status },
      req,
    });

    res.json(finding);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/action-plan/generate",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoActionPlanGenerateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const actionPlan = await generateGeoAeoActionPlan({
      tenantId,
      auditId,
      userId,
      name: parsed.data.name,
      timeHorizonDays: parsed.data.timeHorizonDays,
    });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.action_plan.generated",
      resourceType: "geo_aeo_action_plan",
      resourceId: actionPlan.plan.id,
      metadata: { auditId, items: actionPlan.items.length },
      req,
    });

    res.status(201).json(actionPlan);
  },
);

router.get(
  "/geo-aeo/audits/:auditId/action-plan",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const actionPlan = await getGeoAeoActionPlan({ tenantId, auditId });
    res.json(actionPlan);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/action-items",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoActionItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const actionItem = await createGeoAeoActionItem({
      tenantId,
      auditId,
      userId,
      input: parsed.data,
    });

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.action_item.created",
      resourceType: "geo_aeo_action_item",
      resourceId: actionItem.item.id,
      metadata: { auditId, actionPlanId: actionItem.plan.id },
      req,
    });

    res.status(201).json(actionItem);
  },
);

router.patch(
  "/geo-aeo/action-items/:actionItemId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const actionItemId = parseId(req.params.actionItemId);
    if (actionItemId === null) {
      res.status(400).json({ error: "Invalid actionItemId" });
      return;
    }

    const parsed = geoAeoActionItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const item = await updateGeoAeoActionItem({
      tenantId,
      actionItemId,
      userId,
      input: parsed.data,
    });

    if (!item) {
      res.status(404).json({ error: "Action item not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.action_item.updated",
      resourceType: "geo_aeo_action_item",
      resourceId: item.id,
      metadata: { auditId: item.auditId, status: item.status },
      req,
    });

    res.json(item);
  },
);

router.delete(
  "/geo-aeo/action-items/:actionItemId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const actionItemId = parseId(req.params.actionItemId);
    if (actionItemId === null) {
      res.status(400).json({ error: "Invalid actionItemId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const item = await softDeleteGeoAeoActionItem({ tenantId, actionItemId, userId });
    if (!item) {
      res.status(404).json({ error: "Action item not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.action_item.deleted",
      resourceType: "geo_aeo_action_item",
      resourceId: item.id,
      metadata: { auditId: item.auditId },
      req,
    });

    res.status(204).send();
  },
);

router.post(
  "/geo-aeo/audits/:auditId/report/generate",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoReportGenerateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const generated = await generateGeoAeoReport({
      tenantId,
      auditId,
      userId,
      format: parsed.data.format,
    });

    if (!generated) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }
    if ("error" in generated) {
      res.status(409).json({ error: "GEO/AEO report generation requires a linked project" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.report.generated",
      resourceType: "geo_aeo_report",
      resourceId: generated.report.id,
      metadata: { auditId, format: parsed.data.format },
      req,
    });

    res.status(201).json(generated.report);
  },
);

router.post(
  "/geo-aeo/reports/:reportId/export",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const reportId = parseId(req.params.reportId);
    if (reportId === null) {
      res.status(400).json({ error: "Invalid reportId" });
      return;
    }

    const parsed = geoAeoReportExportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const exported = await exportGeoAeoReport({
      tenantId,
      reportId,
      format: parsed.data.format,
    });
    if (!exported) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.report.exported",
      resourceType: "geo_aeo_report",
      resourceId: reportId,
      metadata: { format: parsed.data.format },
      req,
    });

    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.body);
  },
);

router.post(
  "/geo-aeo/audits/:auditId/approve",
  requireAuth,
  requireRole(GEO_AEO_APPROVER_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    if (!(await getTenantScopedGeoAeoAudit(auditId, tenantId))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const audit = await updateGeoAeoAudit({
      tenantId,
      auditId,
      userId,
      input: { status: "approved" },
    });
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.audit.approved",
      resourceType: "geo_aeo_audit",
      resourceId: audit.id,
      req,
    });

    res.json(audit);
  },
);

router.get(
  "/geo-aeo/audits/:auditId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId } = req.session.user!;
    const audit = await getTenantScopedGeoAeoAudit(auditId, tenantId);
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(audit);
  },
);

router.patch(
  "/geo-aeo/audits/:auditId",
  requireAuth,
  requireRole(GEO_AEO_OPERATOR_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const parsed = geoAeoAuditUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const audit = await updateGeoAeoAudit({ tenantId, auditId, userId, input: parsed.data });
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.audit.updated",
      resourceType: "geo_aeo_audit",
      resourceId: audit.id,
      req,
    });

    res.json(audit);
  },
);

router.delete(
  "/geo-aeo/audits/:auditId",
  requireAuth,
  requireRole(GEO_AEO_APPROVER_ROLES),
  async (req, res): Promise<void> => {
    const auditId = parseId(req.params.auditId);
    if (auditId === null) {
      res.status(400).json({ error: "Invalid auditId" });
      return;
    }

    const { tenantId, id: userId } = req.session.user!;
    const audit = await softDeleteGeoAeoAudit({ tenantId, auditId, userId });
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    await auditGeoAeoEvent({
      tenantId,
      userId,
      action: "geo_aeo.audit.deleted",
      resourceType: "geo_aeo_audit",
      resourceId: audit.id,
      req,
    });

    res.status(204).send();
  },
);

export default router;
