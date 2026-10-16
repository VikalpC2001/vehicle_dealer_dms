#!/usr/bin/env bash
# Shared helpers for the deploy scripts. Source it; do not run it.
#
# Server layout (DEPLOY_ROOT defaults to /opt/dcarjt):
#   $DEPLOY_ROOT/releases/<tag>/   copy of the repository's deploy/ directory for each release
#   $DEPLOY_ROOT/current           symlink to the release that is live
#   $DEPLOY_ROOT/shared/           everything that outlives releases:
#       .env api.env postgres.env  configuration and secrets (chmod 600)
#       certs/                     origin certificate + key
#       nginx/live, nginx/staging  rendered edge nginx configuration
#       backups/postgres, backups/uploads
#       state/                     current/previous release, release log, last backup

set -Eeuo pipefail
# A failing command inside $(…) fails the assignment too (bash ≥ 4.4), instead of being ignored.
shopt -s inherit_errexit

# Directory holding the scripts, and the release directory around it — PHYSICAL paths, so a script
# started through the `current` symlink still knows its real releases/<tag> directory.
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RELEASE_DIR="$(cd -P "$SCRIPT_DIR/.." && pwd -P)"
# DEPLOY_ROOT: as given, else derived from where the scripts live (…/releases/<tag> or …/bootstrap).
if [[ -z "${DEPLOY_ROOT:-}" ]]; then
  if [[ "$(basename "$(dirname "$RELEASE_DIR")")" == releases ]]; then
    DEPLOY_ROOT="$(dirname "$(dirname "$RELEASE_DIR")")"
  elif [[ "$(basename "$RELEASE_DIR")" == bootstrap ]]; then
    DEPLOY_ROOT="$(dirname "$RELEASE_DIR")"
  else
    DEPLOY_ROOT=/opt/dcarjt
  fi
fi
SHARED_DIR="${SHARED_DIR:-$DEPLOY_ROOT/shared}"
STATE_DIR="$SHARED_DIR/state"
export DEPLOY_ROOT SHARED_DIR
# Main nginx configuration inside the nginx container (SHARED_DIR/nginx/live is mounted there).
NGINX_CONF=/etc/nginx/live/nginx.conf

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_TAG:-deploy}" "$*"; }
warn() { log "WARNING: $*" >&2; }
die() {
  log "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is not installed (run scripts/setup-ubuntu.sh first)"
  done
}

# Reads KEY from a KEY=value file without executing it (values may contain shell characters).
env_get() {
  local file="$1" key="$2" line value
  [[ -f "$file" ]] || return 1
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  printf '%s' "$value"
}

# Like env_get, but exits when the key is missing or empty.
env_require() {
  local file="$1" key="$2" value
  value="$(env_get "$file" "$key" || true)"
  [[ -n "$value" ]] || die "$key is not set in $file"
  printf '%s' "$value"
}

# docker compose for this release, with the shared configuration. DC_TIMEOUT=<seconds> bounds the call
# (e.g. a pull from a registry that does not answer).
dc() {
  local cmd=(docker compose --project-directory "$RELEASE_DIR" --env-file "$SHARED_DIR/.env" -f "$RELEASE_DIR/compose.yaml")
  if [[ -n "${DC_TIMEOUT:-}" ]]; then
    timeout "$DC_TIMEOUT" "${cmd[@]}" "$@"
  else
    "${cmd[@]}" "$@"
  fi
}

# Prints which of the given services (api, migrate, frontend) do not have their TAG image on this server.
services_missing_images() {
  local tag="$1" prefix service repo
  shift
  prefix="$(env_require "$SHARED_DIR/.env" REGISTRY)/$(env_require "$SHARED_DIR/.env" IMAGE_NAMESPACE)"
  for service in "$@"; do
    if [[ "$service" == migrate ]]; then repo=api-migrate; else repo="$service"; fi
    docker image inspect "$prefix/$repo:$tag" >/dev/null 2>&1 || printf '%s\n' "$service"
  done
}

# Image of a stack service (nginx, postgres) as compose.yaml resolves it; the images are pinned there.
service_image() {
  local images
  images="$(dc config --images "$1")" || return 1
  images="$(grep -E -m 1 "$1" <<<"$images" || true)"
  [[ -n "$images" ]] || return 1
  printf '%s\n' "$images"
}

# The image tag that is live, or nothing before the first deploy.
current_tag() { cat "$STATE_DIR/current_release" 2>/dev/null || true; }
previous_tag() { cat "$STATE_DIR/previous_release" 2>/dev/null || true; }

# Checks the configuration files exist, are private and have no CHANGE_ME left in them.
validate_config() {
  local file problems=0
  for file in .env api.env postgres.env; do
    if [[ ! -f "$SHARED_DIR/$file" ]]; then
      warn "missing $SHARED_DIR/$file (run scripts/configure-server.sh)"
      problems=$((problems + 1))
      continue
    fi
    if grep -nE '^[A-Z0-9_]+=.*CHANGE_ME' "$SHARED_DIR/$file" >/dev/null; then
      warn "$SHARED_DIR/$file still has CHANGE_ME values: $(grep -E '^[A-Z0-9_]+=.*CHANGE_ME' "$SHARED_DIR/$file" | cut -d= -f1 | tr '\n' ' ')"
      problems=$((problems + 1))
    fi
    if [[ "$file" == api.env ]]; then
      # Only Docker Compose reads api.env, and it expands $NAME in unquoted (and double-quoted)
      # values: a literal $ (e.g. in a password) needs single quotes there.
      if grep -nE "^[A-Z0-9_]+=[^']*\\$" "$SHARED_DIR/$file" >/dev/null; then
        warn "$SHARED_DIR/$file: wrap values that contain \$ in single quotes, e.g. SMTP_PASS='pa\$word'"
        problems=$((problems + 1))
      fi
    elif grep -nE '^[A-Z0-9_]+="|^[A-Z0-9_]+='"'" "$SHARED_DIR/$file" >/dev/null; then
      warn "$SHARED_DIR/$file has quoted values; write KEY=value without quotes"
      problems=$((problems + 1))
    fi
  done
  for file in api.env postgres.env; do
    if [[ -f "$SHARED_DIR/$file" && "$(stat -c '%a' "$SHARED_DIR/$file")" != "600" ]]; then
      warn "$SHARED_DIR/$file must be chmod 600 (it holds secrets)"
      problems=$((problems + 1))
    fi
  done
  local cert key gid mode
  cert="$SHARED_DIR/certs/$(basename "$(env_get "$SHARED_DIR/.env" TLS_CERTIFICATE || echo origin.crt)")"
  key="$SHARED_DIR/certs/$(basename "$(env_get "$SHARED_DIR/.env" TLS_CERTIFICATE_KEY || echo origin.key)")"
  gid="$(env_get "$SHARED_DIR/.env" DEPLOY_GID || true)"
  if [[ ! "$gid" =~ ^[0-9]+$ ]]; then
    warn "DEPLOY_GID in $SHARED_DIR/.env must be the deploy user's group id ($(id -g))"
    problems=$((problems + 1))
  fi
  [[ -f "$cert" ]] || { warn "missing TLS certificate $cert"; problems=$((problems + 1)); }
  if [[ ! -f "$key" ]]; then
    warn "missing TLS private key $key"
    problems=$((problems + 1))
  else
    # nginx (uid 101) reads the key through the DEPLOY_GID group; nobody else should.
    mode=$((8#$(stat -c '%a' "$key")))
    if [[ "$(stat -c '%g' "$key")" != "$gid" ]] || ((!(mode & 8#040))); then
      warn "nginx cannot read $key: run chgrp $gid $key && chmod 640 $key"
      problems=$((problems + 1))
    elif ((mode & 8#007)); then
      warn "$key is readable by every user on this server: run chmod 640 $key"
      problems=$((problems + 1))
    fi
  fi
  ((problems == 0)) || die "configuration is incomplete ($problems problem(s) above)"
}

# Creates the external data volumes when they do not exist yet. Never removes anything.
ensure_volumes() {
  local volume
  for volume in "$(env_require "$SHARED_DIR/.env" POSTGRES_VOLUME)" "$(env_require "$SHARED_DIR/.env" UPLOADS_VOLUME)"; do
    if ! docker volume inspect "$volume" >/dev/null 2>&1; then
      docker volume create "$volume" >/dev/null
      log "created volume $volume"
    fi
  done
}

# The API runs as the image's `node` user; make sure it owns the uploads volume (a new volume is root's).
ensure_uploads_owner() {
  local volume image
  volume="$(env_require "$SHARED_DIR/.env" UPLOADS_VOLUME)"
  image="$(env_require "$SHARED_DIR/.env" REGISTRY)/$(env_require "$SHARED_DIR/.env" IMAGE_NAMESPACE)/api:${IMAGE_TAG:?IMAGE_TAG is not set}"
  docker run --rm --user 0:0 --network none --entrypoint chown \
    -v "$volume:/app/uploads" "$image" node:node /app/uploads
}

# Renders deploy/nginx of RELEASE ($1, default: this release) into shared/nginx/staging and tests it
# with `nginx -t` in a throwaway container. Leaves the live configuration untouched.
render_nginx() {
  local source_dir="${1:-$RELEASE_DIR}/nginx" staging="$SHARED_DIR/nginx/staging"
  local vars='${DOMAIN} ${WWW_DOMAIN} ${API_DOMAIN} ${TLS_CERTIFICATE} ${TLS_CERTIFICATE_KEY} ${CLIENT_MAX_BODY_SIZE} ${PROXY_READ_TIMEOUT} ${AUTH_RATE_LIMIT} ${AUTH_RATE_BURST} ${PUBLIC_WRITE_RATE_LIMIT} ${PUBLIC_WRITE_RATE_BURST} ${HSTS_MAX_AGE}'
  local nginx_image
  nginx_image="$(service_image nginx)" || die "could not determine the nginx image from compose.yaml"

  rm -rf "$staging"
  mkdir -p "$staging/conf.d" "$staging/snippets"
  cp "$source_dir/nginx.conf" "$staging/nginx.conf"
  cp "$source_dir"/snippets/*.conf "$staging/snippets/"

  # envsubst from the nginx image itself (no host dependency); only the listed variables change.
  docker run --rm --network none --user "$(id -u):$(id -g)" \
    --env-file "$SHARED_DIR/.env" \
    -e NGINX_VARS="$vars" \
    -v "$source_dir/templates:/templates:ro" \
    -v "$staging/conf.d:/out" \
    --entrypoint /bin/sh "$nginx_image" -c \
    'set -e; for t in /templates/*.template; do envsubst "$NGINX_VARS" < "$t" > "/out/$(basename "$t" .template)"; done'

  if grep -n '\${' "$staging"/conf.d/*.conf >/dev/null; then
    die "nginx configuration still has unrendered \${...} values: $(grep -ho '\${[A-Z_]*}' "$staging"/conf.d/*.conf | sort -u | tr '\n' ' ')"
  fi

  # Test in a throwaway container set up like the live one (same paths, user and group). On the stack's
  # network when it exists (upstream names then resolve); upstreams use `resolve`, so a name that does
  # not exist yet (first deploy) is not an error either.
  local network="none" edge_network
  edge_network="$(env_require "$SHARED_DIR/.env" COMPOSE_PROJECT_NAME)_edge"
  if docker network inspect "$edge_network" >/dev/null 2>&1; then network="$edge_network"; fi
  if ! docker run --rm --network "$network" \
    --group-add "$(env_require "$SHARED_DIR/.env" DEPLOY_GID)" \
    -v "$staging:/etc/nginx/live:ro" \
    -v "$SHARED_DIR/certs:/etc/nginx/certs:ro" \
    --tmpfs /tmp \
    --entrypoint nginx "$nginx_image" -t -c "$NGINX_CONF"; then
    die "nginx configuration test failed (live configuration left unchanged)"
  fi
  log "nginx configuration rendered and tested"
}

# Copies the tested staging configuration into the live directory, keeping the previous one for
# rollback. The live directory is updated in place: the running container's bind mount keeps
# pointing at the directory it was started with, so it must never be renamed or replaced.
activate_nginx() {
  local live="$SHARED_DIR/nginx/live" previous="$SHARED_DIR/nginx/previous" staging="$SHARED_DIR/nginx/staging"
  if [[ ! -d "$staging/conf.d" ]]; then
    warn "no rendered nginx configuration to activate"
    return 1
  fi
  mkdir -p "$live" "$previous"
  rsync -a --delete "$live/" "$previous/"
  rsync -a --delete "$staging/" "$live/"
}

# Puts the previous nginx configuration back (after a failed deploy).
restore_previous_nginx() {
  local live="$SHARED_DIR/nginx/live" previous="$SHARED_DIR/nginx/previous"
  [[ -f "$previous/nginx.conf" ]] || return 0
  rsync -a --delete "$previous/" "$live/"
}

# Brings nginx in line with this release. `up` creates the container, or recreates it when its image
# or settings changed (a new pinned image, ports, limits); an unchanged container is left running and
# gets the new configuration files through a tested, graceful reload. Returns non-zero (does not exit)
# so deploy.sh's rollback trap still runs.
reload_or_start_nginx() {
  local before after
  before="$(dc ps -q nginx 2>/dev/null || true)"
  if ! dc up -d --no-deps --wait --wait-timeout 60 nginx; then
    warn "nginx did not become healthy"
    return 1
  fi
  after="$(dc ps -q nginx 2>/dev/null || true)"
  if [[ -n "$before" && "$before" == "$after" ]]; then
    if ! dc exec -T nginx nginx -t -q -c "$NGINX_CONF"; then
      warn "nginx rejected the configuration; it was not reloaded"
      return 1
    fi
    dc exec -T nginx nginx -c "$NGINX_CONF" -s reload
    log "nginx reloaded"
  else
    log "nginx started with the new configuration"
  fi
}

# Posts a short message to ALERT_WEBHOOK_URL when one is configured (never fails the caller).
notify() {
  local url message="$1"
  url="$(env_get "$SHARED_DIR/.env" ALERT_WEBHOOK_URL || true)"
  [[ -n "$url" ]] || return 0
  local host
  host="$(hostname)"
  curl -fsS --max-time 10 -H 'Content-Type: application/json' \
    -d "$(printf '{"text":"[%s] %s"}' "$host" "${message//\"/\'}")" "$url" >/dev/null 2>&1 || true
}
