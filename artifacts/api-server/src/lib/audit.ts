import { db, auditLogTable } from "@workspace/db";
import type { Request } from "express";

export interface AuditParams {
  tenantId: number;
  userId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function audit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId != null ? String(params.resourceId) : null,
      metadata: params.metadata ?? null,
      ipAddress: params.req ? (
        (params.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        params.req.socket.remoteAddress ?? null
      ) : null,
      userAgent: params.req?.headers["user-agent"] ?? null,
    });
  } catch {
    // audit failures should never crash the main request
  }
}
