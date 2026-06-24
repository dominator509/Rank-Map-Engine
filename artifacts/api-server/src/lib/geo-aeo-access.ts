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
} from "@workspace/db";
import { audit } from "./audit.js";

export const GEO_AEO_VIEW_ROLES = ["agency_admin", "agency_user", "client", "super_admin"];
export const GEO_AEO_OPERATOR_ROLES = ["agency_admin", "agency_user", "super_admin"];
export const GEO_AEO_APPROVER_ROLES = ["agency_admin", "super_admin"];

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

export async function assertTenantScopedClient(clientId: number, tenantId: number): Promise<boolean> {
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
