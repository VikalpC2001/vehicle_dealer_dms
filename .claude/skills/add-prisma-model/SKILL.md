---
name: add-prisma-model
description: >-
  Add or change a Prisma model and create the migration in EDEALER_RECORD, following the schema
  conventions (UUID PKs, @map/@@map, relations, indexes, tenancy). Use when the user says "add a
  Prisma model", "new table for X", "add a field/relation/enum", or "create a migration".
---

# Add a Prisma model + migration (EDEALER_RECORD)

Deterministic checklist for schema changes. For non-trivial relation/cascade design, delegate to the `prisma-schema-specialist` agent.

## 0. Gather inputs
- Exact fields + types; every relation and its `onDelete` intent; whether dealer-scoped; unique constraints and indexes needed.
- Read `prisma/schema.prisma`, `EDEALER_RECORD/docs/DATA_MODEL.md`, and 1–2 similar existing models to copy patterns.

## 1. Edit `prisma/schema.prisma`
Apply the conventions:
- Model `PascalCase` + `@@map("snake_case_table")`; fields `camelCase` + `@map("snake_case_column")`.
- PK: `<entity>Id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`.
- Timestamps `@db.Timestamp(6)` — `createdAt @default(now())` + `updatedAt @updatedAt` (or match `creationDate`/`modificationDate` if extending `State`/`City`/`User`).
- Define **both** sides of each relation; set `onDelete` (`Cascade` for owned children, `SetNull` for optional refs).
- Dealer-scoped: add `dealerId @db.Uuid`, the `Dealer` relation, `@@index([dealerId])`, and a tenancy `@@unique`.
- `@@index` on FKs/filtered columns; enums `PascalCase` + `UPPER_CASE` values.

## 2. Validate
- `cd EDEALER_RECORD && npx prisma validate`. Fix any errors.

## 3. Migrate
- `npx prisma migrate dev --name <snake_case_description>` (match the existing timestamped migration naming under `prisma/migrations/`). Production applies these with `prisma migrate deploy` on every deploy, so **never** use `prisma db push` for a real change.
- If `migrate dev` reports drift or offers to **reset** the database, stop: never reset or use `--force-reset`. A database built earlier with `db push` first needs `npx prisma migrate resolve --applied 20261014000000_baseline` (ask the user before running it).
- If no database is reachable in this environment, **do not fake it** — report that, and give the user the exact command + the generated SQL to run.

## 4. Generate the client
- `npx prisma generate`.

## 5. Repository types
- Create or extend `src/repositories/<model>.repository.ts` with `Create<X>Data` / `Update<X>Data` interfaces so a slice can be built (or hand to `scaffold-backend-resource`).

## 6. Update docs
- Update `docs/DATA_MODEL.md` (add the model with PK/fields/FKs/uniques/indexes/cascade) and `docs/DOMAIN_GLOSSARY.md` if it introduces a new concept.

## 7. Report
Show the schema diff, migration name, applied/not-applied status, and any backfill concern (e.g. adding a NOT NULL column to a populated table). Do not commit unless asked.
