# Backup and Restore

RankMap uses PostgreSQL as the system of record. Production backup policy should be implemented by the managed database provider, with logical dump/restore kept as the portable recovery proof.

## Local Recovery Proof

Run:

```sh
pnpm run recovery:baseline
```

The recovery baseline:

- Starts a disposable source PostgreSQL database.
- Applies the current migrations.
- Seeds representative tenant, user, client, project, keyword, AI task, and report data.
- Creates a custom-format `pg_dump` backup.
- Restores that dump into a fresh disposable PostgreSQL database.
- Compares source and restored counts plus deterministic checksums.

Latest local proof: 2026-05-18.

| Check | Result |
|-------|--------|
| Dump | 803ms |
| Restore | 2876ms |
| Restored tenants | 1 |
| Restored users | 2 |
| Restored clients | 1 |
| Restored projects | 1 |
| Restored keywords | 120 |
| Restored AI tasks | 60 |
| Restored reports | 2 |
| Fingerprint comparison | Source and restored counts/checksums matched |

## Production Notes

- Enable managed automated backups before launch.
- Keep point-in-time recovery enabled where the database provider supports it.
- Test restore in a non-production environment before launch and after material schema changes.
- Store backup access controls separately from app runtime credentials.
- Treat restored data as production-sensitive and apply the same access, retention, and deletion rules.
