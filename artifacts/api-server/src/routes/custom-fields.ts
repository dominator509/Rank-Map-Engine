import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, customFieldsTable, customFieldValuesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const FieldBody = z.object({
  entityType: z.enum(["project", "keyword", "client"]),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/),
  fieldType: z.enum(["text", "number", "select", "date", "boolean"]),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
});

router.get("/custom-fields", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const { entityType } = req.query;
  let conditions = eq(customFieldsTable.tenantId, tenantId) as ReturnType<typeof and>;
  if (entityType) conditions = and(conditions, eq(customFieldsTable.entityType, entityType as string))!;
  const fields = await db.select().from(customFieldsTable).where(conditions).orderBy(customFieldsTable.createdAt);
  res.json(fields);
});

router.post("/custom-fields", requireAuth, requireRole(["agency_admin", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const parsed = FieldBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const [field] = await db
    .insert(customFieldsTable)
    .values({ ...parsed.data, options: parsed.data.options ?? null, tenantId })
    .returning();
  res.status(201).json(field);
});

router.delete("/custom-fields/:id", requireAuth, requireRole(["agency_admin", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(customFieldsTable).where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// Field values
router.get("/custom-field-values", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) { res.status(400).json({ error: "entityType and entityId required" }); return; }
  const eid = parseInt(entityId as string, 10);
  if (isNaN(eid)) { res.status(400).json({ error: "Invalid entityId" }); return; }

  const values = await db
    .select()
    .from(customFieldValuesTable)
    .where(
      and(
        eq(customFieldValuesTable.tenantId, tenantId),
        eq(customFieldValuesTable.entityType, entityType as string),
        eq(customFieldValuesTable.entityId, eid),
      ),
    );
  res.json(values);
});

router.put("/custom-field-values", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const parsed = z.object({
    fieldId: z.number().int(),
    entityType: z.string(),
    entityId: z.number().int(),
    value: z.unknown(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const { fieldId, entityType, entityId, value } = parsed.data;

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
      .where(eq(customFieldValuesTable.id, existing[0].id))
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
