# Backend API image (Express + TypeScript + Prisma).
#
# Targets:
#   runtime  (default) — the API: compiled JavaScript + production dependencies only, runs as `node`.
#   migrate            — one-off jobs: `prisma migrate deploy` (default command) and the TypeScript
#                        seed / bootstrap scripts under prisma/. Has the full dependency set.
#
# Build (from EDEALER_RECORD/):
#   docker build --target runtime -t api .
#   docker build --target migrate -t api-migrate .
#
# The base image is pinned by digest; update NODE_IMAGE deliberately (and keep it on Node 22 unless
# the app is moved to a newer LTS on purpose).
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

# ── base: Node + OpenSSL (Prisma's query engine links against libssl) ────────────────────────────
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app

# ── deps: every dependency, from the lockfile. `postinstall` runs `prisma generate`. ───────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ── build: compile TypeScript to dist/ ───────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── prod-deps: production dependencies only. Install scripts are skipped (the Prisma CLI that
#    `postinstall` needs is a dev dependency); the generated client is copied from `deps`, and the
#    native modules (bcrypt, sharp) ship prebuilt Linux binaries. ──────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# ── migrate: one-off database jobs, run by deploy/scripts (never as a long-running service) ───────
FROM deps AS migrate
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ── runtime: the API ─────────────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4002
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Uploaded files live here; production mounts a persistent volume on this path.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4002
# Liveness only (no database call): readiness is GET /api/v1/health/ready.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4002) + (process.env.API_PREFIX || '/api/v1') + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
