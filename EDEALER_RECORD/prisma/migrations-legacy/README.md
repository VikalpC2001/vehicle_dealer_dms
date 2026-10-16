# Legacy migrations (kept for reference — not applied)

These nine migrations were written while the database itself was still created with `prisma db push`.
The first one alters a table that no migration creates, so the folder could not build a database from
empty, and `prisma migrate deploy` (the production workflow) cannot use it.

On 2026-10-14 they were replaced by a single baseline, `prisma/migrations/20261014000000_baseline`,
generated from `prisma/schema.prisma` with:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Prisma only reads `prisma/migrations/`, so nothing in this folder runs. It is kept so the history of
the early schema changes stays readable next to the code.

See `deploy/README.md` → "Database migrations" for how existing databases are marked as baselined
and how new schema changes are made from now on (`npx prisma migrate dev --name <change>`).
