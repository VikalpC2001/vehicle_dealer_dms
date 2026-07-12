# API Conventions

How every endpoint in this backend is shaped. The per-endpoint reference is [api/API.md](api/API.md); the importable collection is [postman/EDealer-API.postman_collection.json](postman/EDealer-API.postman_collection.json). **Keep all three in sync** — updating an endpoint without updating API.md + Postman is an incomplete change.

## Base & auth

- Base URL `http://localhost:4002` (per `PORT`), prefix **`/api/v1`** (per `API_PREFIX`). Health: `GET /api/v1/health`.
- Protected routes require `Authorization: Bearer <accessToken>`. Set on a router with `router.use(authenticate)`.
- Access tokens carry `{ sub, email, role, dealerId?, purpose }`. `purpose: 'PASSWORD_RESET'` tokens are rejected by `authenticate` and accepted only by `authenticatePasswordReset` (used solely by `POST /auth/reset-password`).
- The frontend implements a refresh flow against `/auth/refresh` on `401`.

## Response envelopes

**Success** — from `sendSuccess(res, message, data, statusCode)`:
```json
{ "statusCode": 200, "message": "Dealer statuses retrieved", "data": { } }
```

**Paginated** — from `sendPaginated(res, message, items, meta)`:
```json
{
  "statusCode": 200,
  "message": "Vehicles retrieved",
  "data": {
    "data": [ ],
    "meta": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
  }
}
```

**Error** — from the global `errorHandler`:
```json
{
  "success": false,
  "statusCode": 422,
  "code": 4220,
  "message": "Validation failed",
  "errors": { "body.statusData": ["At least one status is required"] }
}
```
`errors` is present only for field-level (Zod) failures. `stack` is included only when `NODE_ENV=development`.

## Pagination contract

List endpoints accept `?page=&limit=` (query). `parsePagination` clamps to **page ≥ 1**, **limit 1–100** (default **10**). Always return `meta` via `buildPaginationMeta(total, query)`.

## Application error-code catalog

`AppError(message, httpStatus, code)` carries an **HTTP status** and a numeric **app `code`** for programmatic handling. Scheme: `40xx` client, `409x` conflict, `41xx/413x/415x` upload, `42xx` validation/sync, `50xx` server. Codes observed in the codebase:

| Code | HTTP | Meaning | Source |
|------|------|---------|--------|
| `4000` | 400 | Related record not found (Prisma P2003) | error.middleware |
| `4001` | 400 | Invalid data / Prisma validation error | error.middleware |
| `4007` | 400 | Upload: filename/extension mismatch | upload |
| `4008` | 400 | Upload: invalid `fileKey` | upload |
| `4009` | 400 | Upload: empty body | upload |
| `4010` | 400 | Upload: bytes don't match declared type | upload |
| `4011` | 400 | Upload: body not raw buffer | upload |
| `4015` | 401 | Wrong token type for resource | auth.middleware |
| `4016` | 401 | Password-reset session required/invalid | auth.middleware |
| `4017` | 401 | Invalid/expired refresh token (bad signature, expired, wrong `purpose`, or unknown user) | auth (`POST /auth/refresh`) |
| `4032` | 403 | `dealerId` does not match your session | dealer-scope |
| `4033` | 403 | Account not linked to a dealer | dealer-scope |
| `4034` | 403 | No access to this resource (wrong dealer) | dealer-scope |
| `4035` | 403 | Account not linked to an agent | agent-scope |
| `4036` | 403 | `agentId` does not match your session | agent-scope |
| `4037` | 403 | No access to this resource (wrong agent / not a party to the entry) | agent-scope / khata service |
| `4038` | 403 | Super-admin-only action (non-admin token forbidden; gated on the JWT `isSuperAdmin`) | dealer-scope (`assertSuperAdmin`) |
| `4040` | 404 | Record not found (Prisma P2025) | error.middleware |
| `4044` | 404 | Agent not found | agent / dealer-agent services |
| `4047` | 404 | Vehicle not found — or, for `GET /vehicles/history`, not handled by this dealer (the 404-not-an-existence-oracle guard) | vehicle service |
| `4060` | 404 | Process expense not found | process-expense service |
| `4054` | 403 | No active dealer↔agent relationship for this khata (posting blocked) | khata service |
| `4059` | 403 | Khata ledger requires a dealer or agent account | khata controller |
| `4090` | 409 | Duplicate / unique conflict (Prisma P2002) | error.middleware |
| `4091` | 409 | Upload: file already exists | upload |
| `4092` | 409 | Duplicate module name for module type | rbac-navigation |
| `4093` | 409 | Duplicate page slug in module | rbac-navigation |
| `4094` | 409 | Duplicate action name on page | rbac-navigation |
| `4097` | 409 | User already linked to the other persona (dealer/agent) | agent-wise-user service |
| `4098` | 409 | Cannot connect: target is not a subscribed real dealer | placeholder-dealer service |
| `4055` | 409 | Ledger entry already reversed | khata service |
| `4130` | 413 | Upload: file too large | upload |
| `4150` | 415 | Upload: unsupported MIME type | upload |
| `4220` | 422 | Zod validation failed (field `errors`) | validate.middleware |
| `4221` | 422 | Empty sync payload ("at least one …") | services |
| `4222`–`4226` | 422 | Duplicate-in-payload / scope / missing-dealerId guards | services |
| `4228` | 422 | Grant the agent access before assigning | process-assignment service |
| `4229` | 422 | Invalid status for this agent | process-assignment service |
| `4056` | 422 | Cannot reverse a reversal entry | khata service |
| `4057` | 422 | Placeholder dealer not connected to a real dealer (khata) | khata service |
| `4058` | 422 | Khata account is already settled (nothing to settle) | khata service |
| `5000` | 500 | Unhandled Prisma / database error | error.middleware |

When adding a new guard, pick the next free code in the right band and **document it here and in API.md**. Reuse existing semantics (e.g. duplicate → `409x`) rather than inventing overlapping codes.

## When you add or change an endpoint (definition of done)

1. Implement the slice (see backend `CLAUDE.md`).
2. Add/edit the request in `docs/postman/EDealer-API.postman_collection.json` (method, full path, headers incl. `Authorization` when required, sample JSON body; folder by route group).
3. Add/edit the entry in `docs/api/API.md` (method, path, auth, request body/params/query with validation rules, success + error shapes, the app error codes it can return).
4. Confirm parity between the route file, API.md, and Postman.

The `update-api-docs` skill automates steps 2–4.
