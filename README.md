# E-Dealer / RTO platform

A multi-tenant SaaS for second-hand vehicle **dealers** and **RTO agents**, with a **super-admin** who approves accounts. Dealers keep vehicle buy/sell records and a per-vehicle process: documents are uploaded and read by OCR, then buyers, tasks and RTO work are assigned to agents. A khata ledger tracks money between dealers and agents.

| Folder | What | Stack |
|--------|------|-------|
| [`EDEALER_RECORD/`](EDEALER_RECORD/) | REST API (`/api/v1`) | Node.js 22 · Express 4 · TypeScript · Prisma 5 · PostgreSQL |
| [`RTO-Super-Admin/`](RTO-Super-Admin/) | Web app (super-admin, dealer and agent views) | React 19 · Vite · Tailwind v4 · shadcn/ui · TanStack Query |
| [`deploy/`](deploy/) | Production: Docker Compose on an Oracle Cloud VM behind Cloudflare | Docker · nginx · bash · systemd |
| [`.github/workflows/`](.github/workflows/) | CI on every push and pull request; deploy on `main` | GitHub Actions |

## Local development

Backend (needs a local PostgreSQL):

```bash
cd EDEALER_RECORD
npm install
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, SMTP_*
npx prisma migrate dev        # create/upgrade the local database from prisma/migrations
npm run dev                   # http://localhost:4002/api/v1/health
```

Web app:

```bash
cd RTO-Super-Admin
npm install
cp .env.example .env          # VITE_API_BASE_URL=/api/v1; Vite proxies /api and /uploads to
                              # VITE_API_PROXY_TARGET (e.g. http://localhost:4002)
npm run dev                   # http://localhost:5173
```

Database changes must be Prisma migrations (`npx prisma migrate dev --name <change>`); every production deploy applies them. See [`EDEALER_RECORD/CLAUDE.md`](EDEALER_RECORD/CLAUDE.md) for the backend conventions and [`RTO-Super-Admin/CLAUDE.md`](RTO-Super-Admin/CLAUDE.md) for the frontend's.

## API documentation

[`EDEALER_RECORD/docs/api/API.md`](EDEALER_RECORD/docs/api/API.md) (endpoint reference), [`EDEALER_RECORD/docs/API_CONVENTIONS.md`](EDEALER_RECORD/docs/API_CONVENTIONS.md) (envelopes and error codes) and the Postman collection in [`EDEALER_RECORD/docs/postman/`](EDEALER_RECORD/docs/postman/).

## Deployment

Pull requests and branch pushes run [CI](.github/workflows/ci.yml). It covers:

- lint and build for both apps;
- a migration drift check;
- a secret scan;
- Docker image builds, plus a full-stack smoke test of the deploy scripts.

Pushes to `main` additionally build the images, push them to Oracle Cloud's registry and deploy them to the VM ([`deploy-production.yml`](.github/workflows/deploy-production.yml)), once the repository variable `DEPLOY_ENABLED` is `true`.

The one-time setup of the server, Cloudflare, the registry and GitHub is in [`deploy/README.md`](deploy/README.md), along with backups, rollback and monitoring.
