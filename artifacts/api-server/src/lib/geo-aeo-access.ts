import type { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { GeoAeoAuditEvent } from "@workspace/shared/geo-aeo";
import {
  clientsTable,
  db,
  geoAeoAuditsTable,
  geoAeoFindingsTable,
  geoAeoPromptsTable,
  projectsTable,
  reportsTable,
  tenantsTable,
} from "@workspace/db";
import { audit } from "./audit.js";

export const GEO_AEO_VIEW_ROLES = ["agency_admin", "agency_user", "client", "super_admin"];
export const GEO_AEO_OPERATOR_ROLES = ["agency_admin", "agency_user", "super_admin"];
export const GEO_AEO_APPROVER_ROLES = ["agency_admin", "super_admin"];
export const GEO_AEO_REPORT_EXPORT_PERMISSION = "geoAeo.exportReports";

const GEO_AEO_REPORT_DOWNLOAD_PLANS = new Set(["agency", "enterprise"]);

export interface GeoAeoAuditAccess {
  id: number;
  tenantId: number;
  clientId: number;
  projectId: number | null;
  status: string;
  approvedAt: Date | null;
}

export interface GeoAeoFindingAccess {
  id: number;
  auditId: number;
  tenantId: number;
  status: string;
  approvedAt: Date | null;
}

export interface GeoAeoPromptAccess {
  id: number;
  auditId: number;
  tenantId: number;
  status: string;
}

export type GeoAeoReportExportAccess =
  | {
      allowed: true;
      permission: typeof GEO_AEO_REPORT_EXPORT_PERMISSION;
      clientDownload: boolean;
      licensePlan: string | null;
    }
  | {
      allowed: false;
      status: 403 | 404;
      error: string;
      permission: typeof GEO_AEO_REPORT_EXPORT_PERMISSION;
      licensePlan?: string | null;
    };

function getGeoAeoReportAuditId(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const audit = (data as { audit?: unknown }).audit;
  if (!audit || typeof audit !== "object") return null;
  const id = (audit as { id?: unknown }).id;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

export async function authorizeGeoAeoReportExport(params: {
  tenantId: number;
  reportId: number;
  role: string;
}): Promise<GeoAeoReportExportAccess> {
  const [report] = await db
    .select({
      id: reportsTable.id,
      tenantId: reportsTable.tenantId,
      projectId: reportsTable.projectId,
      type: reportsTable.type,
      data: reportsTable.data,
    })
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.id, params.reportId),
        eq(reportsTable.tenantId, params.tenantId),
        eq(reportsTable.type, "geo_aeo_visibility_audit"),
      ),
    )
    .limit(1);

  if (!report) {
    return {
      allowed: false,
      status: 404,
      error: "Report not found",
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
    };
  }

  if (GEO_AEO_OPERATOR_ROLES.includes(params.role)) {
    return {
      allowed: true,
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
      clientDownload: false,
      licensePlan: null,
    };
  }

  if (params.role !== "client") {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden",
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
    };
  }

  const [tenant] = await db
    .select({ plan: tenantsTable.plan })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, params.tenantId))
    .limit(1);
  const licensePlan = tenant?.plan ?? "solo";

  if (!GEO_AEO_REPORT_DOWNLOAD_PLANS.has(licensePlan)) {
    return {
      allowed: false,
      status: 403,
      error: "GEO/AEO report export requires geoAeo.exportReports and a report-download license.",
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
      licensePlan,
    };
  }

  const auditId = getGeoAeoReportAuditId(report.data);
  if (!auditId || !report.projectId) {
    return {
      allowed: false,
      status: 403,
      error: "Report is not approved for client export.",
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
      licensePlan,
    };
  }

  const [auditRecord] = await db
    .select({ id: geoAeoAuditsTable.id })
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.id, auditId),
        eq(geoAeoAuditsTable.tenantId, params.tenantId),
        eq(geoAeoAuditsTable.projectId, report.projectId),
        eq(geoAeoAuditsTable.status, "approved"),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!auditRecord) {
    return {
      allowed: false,
      status: 403,
      error: "Report is not approved for client export.",
      permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
      licensePlan,
    };
  }

  return {
    allowed: true,
    permission: GEO_AEO_REPORT_EXPORT_PERMISSION,
    clientDownload: true,
    licensePlan,
  };
}

export async function getTenantScopedGeoAeoAudit(
  auditId: number,
  tenantId: number,
): Promise<GeoAeoAuditAccess | null> {
  const [auditRecord] = await db
    .select({
      id: geoAeoAuditsTable.id,
      tenantId: geoAeoAuditsTable.tenantId,
      clientId: geoAeoAuditsTable.clientId,
      projectId: geoAeoAuditsTable.projectId,
      status: geoAeoAuditsTable.status,
      approvedAt: geoAeoAuditsTable.approvedAt,
    })
    .from(geoAeoAuditsTable)
    .where(
      and(
        eq(geoAeoAuditsTable.id, auditId),
        eq(geoAeoAuditsTable.tenantId, tenantId),
        isNull(geoAeoAuditsTable.deletedAt),
      ),
    )
    .limit(1);

  return auditRecord ?? null;
}

export async function getTenantScopedGeoAeoFinding(
  findingId: number,
  tenantId: number,
): Promise<GeoAeoFindingAccess | null> {
  const [finding] = await db
    .select({
      id: geoAeoFindingsTable.id,
      auditId: geoAeoFindingsTable.auditId,
      tenantId: geoAeoFindingsTable.tenantId,
      status: geoAeoFindingsTable.status,
      approvedAt: geoAeoFindingsTable.approvedAt,
    })
    .from(geoAeoFindingsTable)
    .where(
      and(
        eq(geoAeoFindingsTable.id, findingId),
        eq(geoAeoFindingsTable.tenantId, tenantId),
        isNull(geoAeoFindingsTable.deletedAt),
      ),
    )
    .limit(1);

  return finding ?? null;
}

export async function getTenantScopedGeoAeoPrompt(
  promptId: number,
  tenantId: number,
  auditId?: number,
): Promise<GeoAeoPromptAccess | null> {
  const conditions = [
    eq(geoAeoPromptsTable.id, promptId),
    eq(geoAeoPromptsTable.tenantId, tenantId),
    isNull(geoAeoPromptsTable.deletedAt),
  ];

  if (auditId !== undefined) {
    conditions.push(eq(geoAeoPromptsTable.auditId, auditId));
  }

  const [prompt] = await db
    .select({
      id: geoAeoPromptsTable.id,
      auditId: geoAeoPromptsTable.auditId,
      tenantId: geoAeoPromptsTable.tenantId,
      status: geoAeoPromptsTable.status,
    })
    .from(geoAeoPromptsTable)
    .where(and(...conditions))
    .limit(1);

  return prompt ?? null;
}

export async function assertTenantScopedClient(
  clientId: number,
  tenantId: number,
): Promise<boolean> {
  const [client] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), eq(clientsTable.tenantId, tenantId)))
    .limit(1);

  return Boolean(client);
}

export async function assertTenantScopedProject(
  projectId: number,
  tenantId: number,
  clientId?: number,
): Promise<boolean> {
  const conditions = [eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)];
  if (clientId !== undefined) {
    conditions.push(eq(projectsTable.clientId, clientId));
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(...conditions))
    .limit(1);

  return Boolean(project);
}

export async function auditGeoAeoEvent(params: {
  tenantId: number;
  userId?: number | null;
  action: GeoAeoAuditEvent;
  resourceType: string;
  resourceId?: string | number | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}): Promise<void> {
  await audit({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    req: params.req,
  });
}
