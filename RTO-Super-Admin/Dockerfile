# Frontend image: the Vite production build served by unprivileged nginx on port 8080.
#
# VITE_* values are compiled into the JavaScript bundle and are visible to anyone who loads the site.
# Pass only public values here — never a secret.
#
# Build (from RTO-Super-Admin/):
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.dcarjt.com/api/v1 \
#     --build-arg VITE_APP_NAME="RTO Super Admin" \
#     -t frontend .
#
# Base images are pinned by digest; update them deliberately.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.5-alpine@sha256:56b8272e43a0525f67aed68d1e0794a712d10e3e45a563e118e9a77c817e6f86

# ── build: runs on the build machine's own platform (the output is the same static files for every
#    target CPU, so a multi-platform build does not need emulation here) ─────────────────────────────
# hadolint ignore=DL3029
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .

# Other VITE_* settings (storage key names) use the defaults in src/lib/constants.js.
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME="RTO Super Admin"
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_NAME=${VITE_APP_NAME}
RUN test -n "$VITE_API_BASE_URL" || { echo "VITE_API_BASE_URL build argument is required" >&2; exit 1; } \
  && npm run build

# ── runtime: static files + SPA-aware nginx, running as the unprivileged nginx user ──────────────
FROM ${NGINX_IMAGE} AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
