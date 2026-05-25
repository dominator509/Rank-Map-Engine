import app from "./app";
import { migratePlaintextIntegrationCredentials } from "./lib/integration-credential-migration";
import { logger } from "./lib/logger";
import { ensureSessionTable } from "./lib/session-table";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSessionTable()
  .then(async () => {
    const credentialMigration = await migratePlaintextIntegrationCredentials();
    if (credentialMigration.migrated > 0 || credentialMigration.skipped > 0) {
      logger.info(credentialMigration, "Checked integration credential encryption state");
    }
  })
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to prepare API server startup");
    process.exit(1);
  });
