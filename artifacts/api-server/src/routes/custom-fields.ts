import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  customFieldsTable,
  customFieldValuesTable,
  projectsTable,
  keywordsTable,
  clientsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const EntityType = z.enum(["project", "keyword", "client"]);

const FieldBody = z.object({
  entityType: EntityType,
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/),
  fieldType: z.enum(["text", "number", "select", "date", "boolean"]),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
});

function parsePositiveQueryInt(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function assertEntityAccess(
  entityType: z.infer<typeof EntityType>,
  entityId: number,
  tenantId: number,
): Promise<boolean> {
  if (entityType === "project") {
    const [row] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, entityId), eq(projectsTable.tenantId, tenantId)))
      .limit(1);
    return !!row;
  }
  if (entityType === "keyword") {
    const [row] = await db
      .select({ id: keywordsTable.id })
      .from(keywordsTable)
      .where(and(eq(keywordsTable.id, entityId), eq(keywordsTable.tenantId, tenantId)))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, entityId), eq(clientsTable.tenantId, tenantId)))
    .limit(1);
  return !!row;
}

async function assertFieldAccess(
  fieldId: number,
  entityType: z.infer<typeof EntityType>,
  tenantId: number,
): Promise<boolean> {
  const [field] = await db
    .select({ id: customFieldsTable.id })
    .from(customFieldsTable)
    .where(
      and(
        eq(customFieldsTable.id, fieldId),
        eq(customFieldsTable.entityType, entityType),
        eq(customFieldsTable.tenantId, tenantId),
      ),
    )
    .limit(1);
  return !!field;
}

router.get("/custom-fields", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const { entityType } = req.query;
  let conditions = eq(customFieldsTable.tenantId, tenantId) as ReturnType<typeof and>;
  if (entityType)
    conditions = and(conditions, eq(customFieldsTable.entityType, entityType as string))!;
  const fields = await db
    .select()
    .from(customFieldsTable)
    .where(conditions)
    .orderBy(customFieldsTable.createdAt);
  res.json(fields);
});

router.post(
  "/custom-fields",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const parsed = FieldBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const [field] = await db
      .insert(customFieldsTable)
      .values({ ...parsed.data, options: parsed.data.options ?? null, tenantId })
      .returning();
    res.status(201).json(field);
  },
);

router.delete(
  "/custom-fields/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db
      .delete(customFieldsTable)
      .where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.tenantId, tenantId)));
    res.json({ ok: true });
  },
);

// Field values
router.get("/custom-field-values", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const parsedEntityId = parsePositiveQueryInt(req.query.entityId);
  if (!req.query.entityType || !req.query.entityId) {
    res.status(400).json({ error: "entityType and entityId required" });
    return;
  }
  const parsedQuery = z
    .object({ entityType: EntityType, entityId: z.number().int().positive() })
    .safeParse({
      entityType: req.query.entityType,
      entityId: parsedEntityId,
    });
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid entityId" });
    return;
  }
  const { entityType, entityId } = parsedQuery.data;
  if (!(await assertEntityAccess(entityType, entityId, tenantId))) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const values = await db
    .select()
    .from(customFieldValuesTable)
    .where(
      and(
        eq(customFieldValuesTable.tenantId, tenantId),
        eq(customFieldValuesTable.entityType, entityType),
        eq(customFieldValuesTable.entityId, entityId),
      ),
    );
  res.json(values);
});

router.put("/custom-field-values", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const parsed = z
    .object({
      fieldId: z.number().int(),
      entityType: EntityType,
      entityId: z.number().int().positive(),
      value: z.unknown(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { fieldId, entityType, entityId, value } = parsed.data;
  if (!(await assertFieldAccess(fieldId, entityType, tenantId))) {
    res.status(400).json({ error: "Invalid fieldId" });
    return;
  }
  if (!(await assertEntityAccess(entityType, entityId, tenantId))) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const existing = await db
    .select({ id: customFieldValuesTable.id })
    .from(customFieldValuesTable)
    .where(
      and(
        eq(customFieldValuesTable.tenantId, tenantId),
        eq(customFieldValuesTable.fieldId, fieldId),
        eq(customFieldValuesTable.entityType, entityType),
        eq(customFieldValuesTable.entityId, entityId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(customFieldValuesTable)
      .set({ value: value as never })
      .where(
        and(
          eq(customFieldValuesTable.id, existing[0].id),
          eq(customFieldValuesTable.tenantId, tenantId),
        ),
      )
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(customFieldValuesTable)
      .values({ fieldId, entityType, entityId, value: value as never, tenantId })
      .returning();
    res.status(201).json(created);
  }
});

export default router;
