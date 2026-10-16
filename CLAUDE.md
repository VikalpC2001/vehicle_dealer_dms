# FULL_STACK_RTO — Workspace Map

A multi-tenant SaaS for second-hand **vehicle dealers** and **RTO agents**, with a **super admin** who approves subscriptions. Dealers manage vehicle buy/sell records and a per-vehicle "process" (upload RC/PUC/Insurance/Owner-ID → OCR auto-fills fields → verify & save), record buyer details, create tasks, and assign processes to agents for RTO services (name transfer, etc.). A khata-book ledger tracks money between dealers and agents.

> This folder is **one git repository** (a monorepo) holding two independent apps plus their deployment. Work happens inside one app at a time.

## Apps and deployment

| Folder | Role | Stack | Port | Read first |
|--------|------|-------|------|------------|
| [`EDEALER_RECORD/`](EDEALER_RECORD/) | **Backend** API | Express 4 · TypeScript 5 (strict) · Prisma 5 · PostgreSQL | `4002`, prefix `/api/v1` | [`EDEALER_RECORD/CLAUDE.md`](EDEALER_RECORD/CLAUDE.md) |
| [`RTO-Super-Admin/`](RTO-Super-Admin/) | **Frontend** (Super-Admin panel today) | React 19 · Vite · JavaScript/JSX · Tailwind v4 · shadcn/ui · TanStack Query | `5173` | [`RTO-Super-Admin/CLAUDE.md`](RTO-Super-Admin/CLAUDE.md) |
| [`deploy/`](deploy/) + [`.github/workflows/`](.github/workflows/) | **Production**: Docker Compose stack (nginx, frontend, API, PostgreSQL) on an Oracle Cloud VM behind Cloudflare; CI and deploy via GitHub Actions | Docker · Compose · nginx · bash | 80/443 | [`deploy/README.md`](deploy/README.md) |

Each app has its own `Dockerfile` and `.dockerignore`. Schema changes must ship as Prisma migrations (`prisma migrate dev`), because every deploy runs `prisma migrate deploy`.

## How they connect

- **Backend is the source of truth** for the data model and the API contract. The frontend consumes `/api/v1` over Axios with a JWT `Authorization: Bearer` header and a refresh flow.
- Every new/changed backend endpoint must be reflected in [`EDEALER_RECORD/docs/api/API.md`](EDEALER_RECORD/docs/api/API.md) and the Postman collection — that is the contract the frontend reads.
- **Dealer-facing and Agent-facing UIs do not exist yet.** Per project decision they will be added as **role-gated routes inside `RTO-Super-Admin`** (one app serving super-admin, dealer, and agent by role) — not separate apps. See [`EDEALER_RECORD/docs/ROADMAP.md`](EDEALER_RECORD/docs/ROADMAP.md).

## Working agreements

- **No cross-app assumptions in one edit.** A feature that spans both apps is two coordinated changes (backend slice + frontend page/service), each following its own app's rulebook.
- Pick the right rulebook: backend work → `EDEALER_RECORD/CLAUDE.md`; frontend work → `RTO-Super-Admin/CLAUDE.md`. Both load automatically when you edit files in their folder.
- New backend environment variables go in `EDEALER_RECORD/.env.example` **and** `deploy/api.env.example` (production). New `VITE_*` values are public build arguments: add them to `RTO-Super-Admin/Dockerfile` and the frontend build in `.github/workflows/deploy-production.yml`.

## Claude tooling in this workspace

Agents and skills live in [`.claude/`](.claude/) at this parent level (they load from your working folder):

- **Agents** (`/agents`): `backend-resource-builder`, `prisma-schema-specialist`, `rbac-specialist`, `backend-reviewer`, `frontend-feature-builder`, `shadcn-component-author`.
- **Skills** (`/skills`): `scaffold-backend-resource`, `add-prisma-model`, `wire-rbac-page`, `update-api-docs`, `add-frontend-page`, `create-shadcn-component`, `connect-mock-to-live-api`.

## ⚠️ Stale `.cursor/rules` in the backend

`EDEALER_RECORD/.cursor/rules/*.mdc` predate the current code. Trust the `CLAUDE.md` files and `docs/` over them.

- **Accurate** (mirrored into our docs): `backend-architecture.mdc`, `database-prisma.mdc`, `validation-patterns.mdc`, `project-context.mdc` (tech/architecture parts).
- **Stale / aspirational — do not follow blindly:**
  - `frontend-ui.mdc` — describes **Next.js + Material UI**. The real frontend is **React 19 + Vite + JSX + Tailwind v4 + shadcn**.
  - `financial-system.mdc` and the broader "core modules" list in `project-context.mdc` — describe **unbuilt** features (Ledger/Khata, Expense/Profit, Marketplace, Workflow engine). These are roadmap, not reality.
  - `auth-security.mdc` — the legacy JWT `Role { ADMIN, USER }` enum it references still exists in `src/types/index.ts`, but the real authorization model is the RBAC tables with `RoleType { DEALER, AGENT }`. New work targets the RBAC tables.
