---
name: scaffold-backend-resource
description: >-
  Scaffold a complete backend CRUD resource in EDEALER_RECORD end-to-end (repository → validation →
  service → controller → routes → register → docs), following the layered architecture. Use when the
  user says "scaffold a backend resource", "add a new CRUD module/endpoint for X end-to-end", or wants
  a full vertical slice on the Express + Prisma backend.
---

# Scaffold a backend resource (EDEALER_RECORD)

Produces a vertical slice that matches the existing code. Heavy reasoning can be delegated to the `backend-resource-builder` agent; this is the deterministic checklist.

## 0. Gather inputs
Confirm with the user:
- Resource **name** (singular, kebab-case, e.g. `vehicle-expense`) and **route group** (plural, e.g. `/vehicle-expenses`).
- Whether it's **dealer-scoped** (most are).
- The **Prisma model** it maps to, and the operations needed (list/get/create/update/delete or a custom sync).

## 1. Ensure the Prisma model exists
- Check `prisma/schema.prisma`. If the model is missing, run the **`add-prisma-model`** skill first, then return here.

## 2. Read the template
- Open the `dealer-status` slice: `src/{repositories,validations,services,controllers,routes}/dealer-status.*`. Copy its structure and conventions.

## 3. Repository — `src/repositories/<name>.repository.ts`
- Import `prisma` from `../config/prisma`. Export `Create<X>Data` / `Update<X>Data` interfaces and CRUD functions. Use `prisma.$transaction` for multi-step writes. JSDoc every export. **Only this layer touches `prisma`.**

## 4. Validation — `src/validations/<name>.validation.ts`
- Zod `z.object({ body?/params?/query? })` per operation. UUIDs `z.string().uuid()`; list query `page`/`limit` optional. Export inferred types (`export type Create<X>Body = z.infer<typeof create<X>Schema>['body']`).

## 5. Service — `src/services/<name>.service.ts`
- Business rules; `throw new AppError(message, StatusCodes.X, code)` (codes per `docs/API_CONVENTIONS.md`). Enforce dealer scope. Import the repository, never `prisma`.

## 6. Controller — `src/controllers/<name>.controller.ts`
- Thin handlers: cast `req.body as <X>Body`, `resolveDealerIdFromRequest(req, body.dealerId)` when tenant-scoped, call the service, then `sendSuccess(res, message, data, statusCode)` or `sendPaginated`. No try/catch.

## 7. Routes — `src/routes/<name>.routes.ts`
- `const router = Router(); router.use(authenticate);` then `router.<verb>('/', validate(schema), asyncHandler(handler))`. Put static paths (e.g. `/order`) before `/:param`.

## 8. Register — `src/routes/index.ts`
- Add `import <name>Routes from './<name>.routes'` and `router.use('/<plural>', <name>Routes)`.

## 9. Docs + lint
- Run the **`update-api-docs`** skill to update `docs/api/API.md` + the Postman collection for each endpoint.
- Run `npm run lint` (in `EDEALER_RECORD`) and fix issues.

## 10. Report
List files created, endpoints added (method + path + auth + app error codes), and any assumptions. Do not commit unless asked.
