# Database Migrations

RankMap uses Drizzle migration files for production database changes.

## Commands

- Generate migration files after schema changes:

  ```powershell
  corepack pnpm run db:generate
  ```

- Apply pending migrations to the configured database:

  ```powershell
  $env:DATABASE_URL="postgresql://..."
  corepack pnpm run db:migrate
  ```

## Release Flow

1. Edit schema files in `lib/db/src/schema`.
2. Run `corepack pnpm run db:generate`.
3. Review and commit the generated files under `lib/db/drizzle`.
4. Run `corepack pnpm run test:e2e:api`; this builds a disposable Postgres database from migrations.
5. During deployment, run `corepack pnpm run deploy:preflight` before starting the new app version. The preflight applies pending migrations with `db:migrate`.

## Important Notes

- `drizzle-kit push` is for local throwaway databases only. Do not use it against production.
- Back up production before applying migrations.
- Apply migrations from exactly one deploy job at a time.
- If an existing database was created with `drizzle-kit push` before migrations existed, do not run the initial migration blindly against it. Either create a fresh migrated database and move data into it, or do a one-time baseline with a database backup and a checked migration history entry.
