# API Conventions

How every endpoint in this backend is shaped. The per-endpoint reference is [api/API.md](api/API.md); the importable collection is [postman/EDealer-API.postman_collection.json](postman/EDealer-API.postman_collection.json). **Keep all three in sync** — updating an endpoint without updating API.md + Postman is an incomplete change.

## Base & auth

- Base URL `http://localhost:4002` (per `PORT`), prefix **`/api/v1`** (per `API_PREFIX`). Health: `GET /api/v1/health`.
- Protected routes require `Authorization: Bearer <accessToken>`. Set on a router with `router.use(authenticate)`.
- Access tokens carry `{ sub, email, role, dealerId?, purpose }`. `purpose: 'PASSWORD_RESET'` tokens are rejected by `authenticate` and accepted only by `authenticatePasswordReset` (used solely by `POST /auth/reset-password`).
- The frontend implements a refresh flow against `/auth/refresh` on `401`.
- `authenticate` also does a live (short-cached) check that the token's linked dealer/agent firm is not **paused** by the super-admin; a paused firm gets **`403` / `4022`** on every guarded route (no `/auth` exemption). It is deliberately not a `401`: the frontend must sign the user out, not refresh.

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
| `4020` | 402 | Agent subscription required for independent management (own placeholder dealers) | managed-dealer-scope (`assertAgentSubscribed`) |
| `4022` | 403 | Firm access paused by the super-admin (`Dealer.isActive` / `Agent.isActive` = `false`) — sign-in refused and live sessions rejected on **every** authenticated route, `/auth` included. Message: `Your account access has been paused. Please contact the super admin.` | firm-access service (`issueUserAccessToken` sign-in gate + auth middleware live check) |
| `4032` | 403 | `dealerId` does not match your session | dealer-scope |
| `4033` | 403 | Account not linked to a dealer | dealer-scope |
| `4034` | 403 | No access to this resource (wrong dealer) | dealer-scope |
| `4035` | 403 | Account not linked to an agent | agent-scope |
| `4036` | 403 | `agentId` does not match your session | agent-scope |
| `4037` | 403 | No access to this resource (wrong agent / not a party to the entry) | agent-scope / khata service |
| `4038` | 403 | Super-admin-only action (non-admin token forbidden; gated on the JWT `isSuperAdmin`) | dealer-scope (`assertSuperAdmin`) |
| `4039` | 403 | Agent does not manage this dealer (not an owned placeholder or an active grant) | managed-dealer-scope |
| `4062` | 403 | Cannot edit/delete a comment you did not author (delete also allowed for super-admin) | process-comment controller |
| `4063` | 403 | Agent-only process write (RTO receipt / RC-book tracking) — caller is not the agent working this process | managed-dealer-scope (`assertAgentCanWriteProcess`) |
| `4064` | 422 | An ACTIVE buyer already exists on the process — use "change buyer" (cancel + add) instead | person service |
| `4040` | 404 | Record not found (Prisma P2025) | error.middleware |
| `4044` | 404 | Agent not found — or, for `GET /process-assignments/by-agent/:agentId[/summary]`, an agent the dealer has never granted | agent / dealer-agent / process-assignment services |
| `4047` | 404 | Vehicle not found — or, for `GET /vehicles/history`, not handled by this dealer (the 404-not-an-existence-oracle guard) | vehicle service |
| `4060` | 404 | Process expense not found | process-expense service |
| `4061` | 404 | Agent invitation not found | agent-invitation service |
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
| `4091` | 409 | Account with this email already exists (also legacy: upload file exists) | agent-wise-user / agent-invitation service |
| `4110` | 409 | Agent invitation already used/cancelled (no longer pending) | agent-invitation service |
| `4111` | 409 | Agent invitation expired | agent-invitation service |
| `4112` | 409 | Email/mobile already an existing agent — grant instead | agent-invitation service |
| `4113` | 409 | An OPEN (status-less) vehicle process already exists for this vehicle under this dealer — at most one open process per vehicle per dealer (set/clear its status first) | vehicle-process service (create / start / reopen) |
| `4114` | 409 | A vehicle can have at most 5 photos (`kind='VEHICLE'` cap on `POST /process-upload-photos`) | process-upload-photo service |
| `4115` | 409 | Only vehicle photos can be starred (`PATCH /process-upload-photos/:id/star` on a `DOCUMENT` row) | process-upload-photo service |
| `4021` | 403 | Account pending approval / registration declined — self-registered dealer/agent whose firm is not `APPROVED` (blocked on all non-`/auth` routes) | auth middleware |
| `4065` | 404 | Registration (dealer/agent) not found | registration service |
| `4066` | 404 | Dealer task template not found | dealer-task-template service |
| `4067` | 403 | Missing dealer capability — the caller's freshly-resolved capability set lacks the one this route requires | dealer-capabilities (`requireCapability`) |
| `4068` | 422 | Unknown capability key(s) in a role's `capabilities[]` (not in the fixed catalog) | dealer-role service |
| `4069` | 404 | Dealer tag not found | dealer-tag service |
| `4130` | 413 | Upload: file too large | upload |
| `4150` | 415 | Upload: unsupported MIME type | upload |
| `4220` | 422 | Zod validation failed (field `errors`) | validate.middleware |
| `4221` | 422 | Empty sync payload ("at least one …") | services |
| `4222`–`4226` | 422 | Duplicate-in-payload / scope / missing-dealerId guards | services |
| `4228` | 422 | Grant the agent access before assigning | process-assignment service |
| `4229` | 422 | Invalid status for this agent | process-assignment service |
| `4230` | 422 | Process already assigned to this agent for this service (edit that assignment instead) | process-assignment service |
| `4231` | 422 | Agent cap reached — no free slot (grant / invite / switch) | dealer-agent · agent-invitation · switch services |
| `4232` | 422 | Requested `maxAgents` is below the dealer's current active usage | dealer-agent-slots service |
| `4233` | 422 | Switch target is already an ACTIVE grant | dealer-agent-switch service |
| `4234` | 422 | Process has no agent board, or the target status is not the agent's (agent-board move) | vehicle-process service |
| `4235` | 422 | One or more tagIds do not belong to this dealer (set-process-tags) | vehicle-process service |
| `4236` | 422 | `assignmentId` on a ledger entry does not belong to the entry's dealer↔agent pair (or does not exist) | khata service |
| `4056` | 422 | Cannot reverse a reversal entry | khata service |
| `4057` | 422 | Placeholder khata: agent must own the placeholder (independent ledger) or connect it to a real dealer first | khata service |
| `4058` | 422 | Khata account is already settled (nothing to settle) | khata service |
| `5000` | 500 | Unhandled Prisma / database error | error.middleware |

When adding a new guard, pick the next free code in the right band and **document it here and in API.md**. Reuse existing semantics (e.g. duplicate → `409x`) rather than inventing overlapping codes.

## When you add or change an endpoint (definition of done)

1. Implement the slice (see backend `CLAUDE.md`).
2. Add/edit the request in `docs/postman/EDealer-API.postman_collection.json` (method, full path, headers incl. `Authorization` when required, sample JSON body; folder by route group).
3. Add/edit the entry in `docs/api/API.md` (method, path, auth, request body/params/query with validation rules, success + error shapes, the app error codes it can return).
4. Confirm parity between the route file, API.md, and Postman.

The `update-api-docs` skill automates steps 2–4.
