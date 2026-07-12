# EDEALER_RECORD — Backend Rulebook

Express 4 + TypeScript 5 (strict) + Prisma 5 + PostgreSQL API for the RTO dealer/agent platform. Clean layered architecture, Zod validation, JWT/OTP/WebAuthn auth, and a full RBAC layer.

> Companion docs in [`docs/`](docs/): [DOMAIN_GLOSSARY](docs/DOMAIN_GLOSSARY.md) · [DATA_MODEL](docs/DATA_MODEL.md) · [API_CONVENTIONS](docs/API_CONVENTIONS.md) · [ROADMAP](docs/ROADMAP.md). Existing references: [docs/api/API.md](docs/api/API.md), [docs/database/RBAC.md](docs/database/RBAC.md), [docs/postman/](docs/postman/).

## Run & tooling

```bash
npm install                 # also runs `prisma generate` (postinstall)
cp .env.example .env        # then set DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, etc.
npm run prisma:push         # or prisma:migrate for a tracked migration
npm run dev                 # tsx watch src/server.ts → http://localhost:4002
```

Other scripts: `build` (tsc), `start` (node dist), `lint` / `lint:fix` (eslint src --ext .ts), `format` (prettier), `prisma:migrate|studio|push|generate`. **No test runner and no seed script exist yet** — don't invent test commands. Port `4002`, prefix `/api/v1` (configurable via `PORT` / `API_PREFIX`).

## Architecture — strict layering

```
Route → Controller → Service → Repository → Prisma
         (HTTP)      (logic)   (DB access)
```

- **Controllers** (`src/controllers/`): HTTP only. Extract the validated body, call a service, then `sendSuccess(res, message, data, statusCode)`. **Never** import `prisma`. **Never** `try/catch` — let errors propagate to the global handler.
- **Services** (`src/services/`): business logic and orchestration. Throw `AppError(message, StatusCodes.X, appCode)` for rule violations. Import repositories, **never** `prisma` directly. Export named async functions, not classes.
- **Repositories** (`src/repositories/`): the **only** layer that touches `prisma`. One file per model. Export `CreateXData` / `UpdateXData` input interfaces and CRUD functions (`createX`, `findXById`, `listX`, `updateX`, `deleteX`). Return Prisma types.
- **Validations** (`src/validations/`): Zod schemas wrapping `{ body?, params?, query? }`, applied via the `validate()` middleware. Export the inferred body/params types next to each schema.

**Canonical template to copy:** the `dealer-status` slice —
[controller](src/controllers/dealer-status.controller.ts) · [service](src/services/dealer-status.service.ts) · [repository](src/repositories/dealer-status.repository.ts) · [routes](src/routes/dealer-status.routes.ts) · [validation](src/validations/dealer-status.validation.ts). **Read it before writing a new resource.**

## File-creation order for a new resource (8 steps)

For a resource `widget` (singular, kebab-case; route group `/widgets`):

1. **Prisma** — add/confirm the model in `prisma/schema.prisma` and run a migration (use the `add-prisma-model` skill / `prisma-schema-specialist` agent).
2. **Repository** `src/repositories/widget.repository.ts` — `CreateWidgetData`/`UpdateWidgetData` interfaces + CRUD fns. All `prisma` calls live here. Use `prisma.$transaction` for multi-step writes (see dealer-status `syncDealerStatusesForDealer`).
3. **Validation** `src/validations/widget.validation.ts` — Zod `z.object({ body/params/query })` + `export type CreateWidgetBody = z.infer<typeof createWidgetSchema>['body']`.
4. **Service** `src/services/widget.service.ts` — business rules, `AppError` throws, dealer-scope enforcement. Calls the repository.
5. **Controller** `src/controllers/widget.controller.ts` — thin handlers calling the service + `sendSuccess`.
6. **Routes** `src/routes/widget.routes.ts` — `router.use(authenticate)`, then `router.<verb>('/', validate(schema), asyncHandler(handler))`.
7. **Register** in [`src/routes/index.ts`](src/routes/index.ts): `import widgetRoutes from './widget.routes'` and `router.use('/widgets', widgetRoutes)`.
8. **Docs** — add/update the endpoint in `docs/api/API.md` and `docs/postman/EDealer-API.postman_collection.json` (use the `update-api-docs` skill). **This is part of the definition of done.**

Then run `npm run lint`.

## Conventions

- **Naming:** files & routes `kebab-case` (`vehicle-process.service.ts`, `/vehicle-processes`); functions/vars `camelCase`; constants/env `UPPER_SNAKE_CASE`; Prisma models `PascalCase` + `@@map("snake_case")`; columns `camelCase` field + `@map("snake_case")`.
- **No `any`.** Use `unknown` + narrowing or a real type. **`import type`** for type-only imports.
- **JSDoc on every exported function.** Repositories document the create/update interfaces.
- **UUID PKs** via `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`; timestamps `@db.Timestamp(6)`.
- **Prettier:** single quotes, trailing commas, 100 print width, 2-space indent.
- Passwords hashed with bcrypt (`config.BCRYPT_SALT_ROUNDS`); never log passwords, tokens, or secrets.

## Responses & errors

Use the helpers in [`src/utils/api-response.ts`](src/utils/api-response.ts):

- `sendSuccess(res, message, data, statusCode = 200)` → `{ statusCode, message, data }`.
- `sendPaginated(res, message, items, meta)` → `{ statusCode, message, data: { data: items, meta } }`.
- Build pagination with `parsePagination(query)` → `{ skip, take }` and `buildPaginationMeta(total, query)` from [`src/utils/pagination.ts`](src/utils/pagination.ts) (default limit 10, max 100).

For errors, **throw** `new AppError(message, StatusCodes.X, appCode)` from services; wrap handlers with `asyncHandler` in the route file so rejections reach the global `errorHandler` ([`src/middlewares/error.middleware.ts`](src/middlewares/error.middleware.ts)), which also maps Prisma errors: `P2002 → 409 (4090)`, `P2025 → 404 (4040)`, `P2003 → 400 (4000)`. The Zod `validate()` middleware returns `422` with code `4220` and field errors. See [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md) for the full numeric code catalog.

## Auth & multi-tenancy

- `authenticate` ([auth.middleware.ts](src/middlewares/auth.middleware.ts)) verifies the Bearer token and sets `req.user` = `{ sub, email, role, dealerId?, purpose? }`. It rejects `PASSWORD_RESET` tokens. `authenticatePasswordReset` accepts only those (for `POST /auth/reset-password`). `authorize(...roles)` restricts by the **legacy** `Role` enum.
- **Dealer tenancy** — every dealer-scoped query must filter by `dealerId`. Resolve it with helpers from [`src/utils/dealer-scope.ts`](src/utils/dealer-scope.ts):
  - `resolveDealerIdFromRequest(req, explicitId?)` — `ADMIN` must pass an explicit `dealerId`; other roles use the token's `dealerId` (and an explicit value must match it). Throws `4226`/`4032`/`4033`.
  - `assertDealerMatchesToken(req, entityDealerId)` — guards that a fetched resource belongs to the caller's dealer (admins bypass). Throws `4033`/`4034`.
  - Controllers call `resolveDealerIdFromRequest` and pass the result into the service (see `dealer-status.controller.ts`).

## RBAC

Authorization model lives in DB tables: **`Module → Page → PageAction`** (catalog of the UI surface) and **`Role → RolePermission`** + **`UserRole`** (who can do what). Key rules:

- `Role.roleType` / `Module.moduleType` use the **`RoleType` enum (`DEALER` | `AGENT`)** — this scopes the dealer app surface vs the agent app surface.
- `Role.typeId` (required) = the dealer id or agent id; interpret it via `roleType` (no polymorphic FK).
- **Default-deny:** a *missing* `RolePermission` row means deny. A row with `isAllowed: false` is an explicit deny (rare).
- `Page.slug` is unique **per module** (`@@unique([moduleId, slug])`).
- Sync semantics (see [`src/services/rbac-navigation.service.ts`](src/services/rbac-navigation.service.ts)): array sync = create (item without id) / update (item with id) / delete (existing not in payload); `sortOrder` follows array order. Use the `wire-rbac-page` skill or `rbac-specialist` agent.

## ⚠️ Migration caveat — two role systems

There are **two** notions of "role" in this codebase:

1. **Legacy JWT claim** — `enum Role { ADMIN, USER }` in [`src/types/index.ts`](src/types/index.ts), used by `authorize()` and the `dealer-scope` helpers (`req.user.role === Role.ADMIN`).
2. **RBAC tables** — `RoleType { DEALER, AGENT }` + `Role/RolePermission/UserRole`, the real per-tenant permission model.

The system is mid-migration from (1) to (2). **New authorization logic should target the RBAC tables** (`RoleType`, `RolePermission`). Keep using `authorize()` / `Role.ADMIN` only where existing code already relies on it (e.g. dealer-scope admin bypass). When in doubt, ask before adding a new dependence on the legacy enum.

## External services

- **Google Gemini** vision OCR — [`src/services/ai.service.ts`](src/services/ai.service.ts), routes `/ai/*`. Extracts vehicle/owner fields from RC and ID photos. Needs `GEMINI_API_KEY` / `GEMINI_MODEL`.
- **File storage** — two-step signed-URL-style upload (`/upload/generate` then `PUT /upload/file/:key`), local disk today with a GCS provider scaffold in `src/storage/`. See API.md.
- **SMTP** (nodemailer) for OTP emails; **WebAuthn** for passkeys.

## Definition of done

Code compiles + migration applied (if schema changed) + `docs/api/API.md` and Postman updated + `npm run lint` clean.
