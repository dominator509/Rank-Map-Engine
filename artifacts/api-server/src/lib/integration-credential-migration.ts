import { eq } from "drizzle-orm";
import { db, integrationCredentialsTable } from "@workspace/db";
import {
  encryptIntegrationCredentials,
  isEncryptedIntegrationCredentials,
  normalizeIntegrationCredentials,
} from "./integration-credentials.js";

export type IntegrationCredentialMigrationResult = {
  total: number;
  migrated: number;
  skipped: number;
};

export async function migratePlaintextIntegrationCredentials(): Promise<IntegrationCredentialMigrationResult> {
  const rows = await db
    .select({
      id: integrationCredentialsTable.id,
      credentials: integrationCredentialsTable.credentials,
    })
    .from(integrationCredentialsTable);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isEncryptedIntegrationCredentials(row.credentials)) continue;

    const normalized = normalizeIntegrationCredentials(row.credentials);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    await db
      .update(integrationCredentialsTable)
      .set({
        credentials: encryptIntegrationCredentials(normalized),
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentialsTable.id, row.id));
    migrated += 1;
  }

  return { total: rows.length, migrated, skipped };
}
