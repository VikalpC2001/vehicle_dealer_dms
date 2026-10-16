#!/usr/bin/env bash
# Deploys one release on this server. Run as the deploy user, from the release's own directory:
#
#   $DEPLOY_ROOT/releases/<tag>/scripts/deploy.sh <tag> [--skip-migrations] [--no-backup] [--no-pull]
#
# <tag> is the image tag built by CI (the full git commit SHA). GitHub Actions copies deploy/ to
# $DEPLOY_ROOT/releases/<tag>/ and runs this script; it can also be run by hand.
#
# Steps: validate configuration → pull images → start PostgreSQL → back up → migrate → render and test
# nginx → replace the API and frontend containers → reload nginx → health check → record the release.
# On a failed health check the previous release's containers and nginx configuration are put back
# (AUTO_ROLLBACK=true). The database is never rolled back automatically.
#
# Note: replacing the API container means a few seconds in which requests get a 503 from nginx. This
# is a single-instance deployment, not zero-downtime.
LOG_TAG=deploy
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

TAG=""
RUN_MIGRATIONS=true
TAKE_BACKUP=true
PULL=true
while (($#)); do
  case "$1" in
    --skip-migrations) RUN_MIGRATIONS=false ;;
    --no-backup) TAKE_BACKUP=false ;;
    --no-pull) PULL=false ;;
    -h | --help) usage 0 ;;
    -*) die "unknown option $1" ;;
    *) [[ -z "$TAG" ]] || die "only one tag may be given"; TAG="$1" ;;
  esac
  shift
done
[[ -n "$TAG" ]] || usage 1
[[ "$TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || die "invalid image tag: $TAG"
# Release directories are $DEPLOY_ROOT/releases/<tag> (pruning, rollback and `current` rely on it).
release_path="$DEPLOY_ROOT/releases/$TAG"
[[ "$(cd -P "$release_path" 2>/dev/null && pwd -P)" == "$RELEASE_DIR" ]] ||
  die "run $release_path/scripts/deploy.sh for $TAG (this script is in $RELEASE_DIR)"
export IMAGE_TAG="$TAG"

require_cmd docker curl flock rsync
docker compose version >/dev/null 2>&1 || die "the docker compose plugin is not installed"

mkdir -p "$STATE_DIR"
# One deploy (or rollback) at a time on this server.
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy or rollback is running"

PREVIOUS_TAG="$(current_tag)"
log "deploying $TAG (live: ${PREVIOUS_TAG:-none}) from $RELEASE_DIR"

validate_config
dc config --quiet || die "compose configuration is invalid"
ensure_volumes

free_kb="$(df -Pk "$DEPLOY_ROOT" | awk 'NR==2 {print $4}')"
((free_kb > 2 * 1024 * 1024)) || die "less than 2 GB free on $DEPLOY_ROOT; free space before deploying (docker system df)"

if [[ "$PULL" == true ]]; then
  log "pulling images"
  if ! DC_TIMEOUT=900 dc --profile tools pull --quiet api frontend migrate postgres nginx; then
    die "could not pull images for $TAG within 15 minutes (registry login on this server? the deploy workflow logs in first; by hand: docker login $(env_get "$SHARED_DIR/.env" REGISTRY))"
  fi
fi
ensure_uploads_owner

# A new PostgreSQL MAJOR version would start an empty cluster next to the data; never do that silently.
postgres_image="$(service_image postgres)" || die "could not determine the postgres image from compose.yaml"
# `up` would pull a missing image anyway; get it now so it can be checked first.
docker image inspect "$postgres_image" >/dev/null 2>&1 || timeout 600 docker pull --quiet "$postgres_image" >/dev/null ||
  die "could not pull $postgres_image"
postgres_id="$(dc ps -q postgres 2>/dev/null || true)"
if [[ -n "$postgres_id" ]]; then
  running_major="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$postgres_id" | sed -n 's/^PG_MAJOR=//p')"
  new_major="$(docker image inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$postgres_image" | sed -n 's/^PG_MAJOR=//p')"
  if [[ -n "$running_major" && -n "$new_major" && "$running_major" != "$new_major" ]]; then
    die "this release moves PostgreSQL from $running_major to $new_major; a major upgrade needs a dump and restore (deploy/README.md, section 14). Nothing was changed."
  fi
fi
# Also when PostgreSQL is not running: the data volume must hold this image's major version, or be empty.
# (Mounted at a path the image does not have, so Docker does not copy anything into an empty volume.)
if ! docker run --rm --network none \
  --mount "type=volume,src=$(env_require "$SHARED_DIR/.env" POSTGRES_VOLUME),dst=/check,readonly" \
  --entrypoint sh "$postgres_image" -c '[ -s "/check/${PGDATA#/var/lib/postgresql/}/PG_VERSION" ] || [ -z "$(ls -A /check)" ]'; then
  die "the database volume holds data of another PostgreSQL major version than $postgres_image; a major upgrade needs a dump and restore (deploy/README.md, section 14). Nothing was changed."
fi

# Back up the database before anything changes. Database only: migrations never touch uploaded files,
# and the daily backup covers those.
backed_up=false
pre_deploy_backup() {
  log "backing up the database before migrating"
  "$SCRIPT_DIR/backup-postgres.sh" --label "pre-deploy-${TAG:0:12}" --db-only --skip-offsite
  backed_up=true
}
if [[ "$TAKE_BACKUP" == true && -n "$PREVIOUS_TAG" && -n "$postgres_id" ]]; then pre_deploy_backup; fi

log "starting PostgreSQL"
dc up -d --wait --wait-timeout 180 postgres
if [[ "$TAKE_BACKUP" == true && -n "$PREVIOUS_TAG" && "$backed_up" == false ]]; then pre_deploy_backup; fi

if [[ "$RUN_MIGRATIONS" == true ]]; then
  log "applying database migrations (prisma migrate deploy)"
  # Full output stays on the server: database errors can quote row values. Only names and codes are shown.
  migrate_log="$STATE_DIR/migrate-${TAG:0:12}.log"
  if ! (umask 077 && dc --profile tools run --rm -T migrate >"$migrate_log" 2>&1); then
    grep -E '^(Error: P[0-9]+|Migration name:)' "$migrate_log" || true
    die "migrations failed; the running release was not changed (full output on the server: $migrate_log)"
  fi
  grep -E '^(Applying migration|All migrations have been|No pending migrations)' "$migrate_log" || true
fi

render_nginx "$RELEASE_DIR"

# From here on a failure puts the previous release back.
NGINX_ACTIVATED=false
rollback_on_failure() {
  local status=$?
  trap - ERR
  log "deploy of $TAG failed (exit $status)"
  dc ps || true
  # Container logs hold visitor IPs and URLs: keep them on the server, never in the CI log.
  local diagnostics="$STATE_DIR/deploy-${TAG:0:12}-failure.log"
  (umask 077 && dc logs --no-color --tail=300 api frontend nginx >"$diagnostics" 2>&1) || true
  log "container logs of the failed deploy: $diagnostics"
  notify "Deploy of ${TAG:0:12} failed on $(env_get "$SHARED_DIR/.env" DOMAIN)"
  if [[ "$(env_get "$SHARED_DIR/.env" AUTO_ROLLBACK || echo true)" == "true" && -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$TAG" ]]; then
    warn "putting the previous release ($PREVIOUS_TAG) back; the database stays migrated"
    # Only when this deploy already switched it; otherwise the live configuration is still the old one.
    if [[ "$NGINX_ACTIVATED" == true ]]; then restore_previous_nginx; fi
    local previous_release="$DEPLOY_ROOT/releases/$PREVIOUS_TAG"
    [[ -f "$previous_release/compose.yaml" ]] || previous_release="$RELEASE_DIR"
    IMAGE_TAG="$PREVIOUS_TAG" RELEASE_DIR="$previous_release" dc up -d --wait --wait-timeout 180 api frontend || true
    IMAGE_TAG="$PREVIOUS_TAG" RELEASE_DIR="$previous_release" reload_or_start_nginx || true
    warn "previous release restored; check it with scripts/health-check.sh"
  fi
  exit "$status"
}
trap rollback_on_failure ERR

log "replacing the API and frontend containers"
dc up -d --wait --wait-timeout 240 --remove-orphans api frontend
NGINX_ACTIVATED=true
activate_nginx
reload_or_start_nginx

log "health check"
"$SCRIPT_DIR/health-check.sh" --deploy

trap - ERR

# Record the release.
if [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$TAG" ]]; then
  printf '%s\n' "$PREVIOUS_TAG" >"$STATE_DIR/previous_release"
fi
printf '%s\n' "$TAG" >"$STATE_DIR/current_release"
printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TAG" "deployed" >>"$STATE_DIR/releases.log"
ln -sfn "$release_path" "$DEPLOY_ROOT/current.tmp" && mv -T "$DEPLOY_ROOT/current.tmp" "$DEPLOY_ROOT/current"

# First deploy: take a baseline backup right away (the daily timer takes over from tonight).
if [[ -z "$PREVIOUS_TAG" && "$TAKE_BACKUP" == true ]]; then
  "$SCRIPT_DIR/backup-postgres.sh" --label first-deploy --skip-offsite || warn "the first backup failed; run scripts/backup-postgres.sh by hand"
fi

# Keep the last RELEASES_TO_KEEP release directories and their images; never touch volumes.
keep="$(env_get "$SHARED_DIR/.env" RELEASES_TO_KEEP || echo 5)"
[[ "$keep" =~ ^[0-9]+$ ]] && ((keep >= 2)) || keep=5
mapfile -t kept_tags < <(awk '$3 == "deployed" {print $2}' "$STATE_DIR/releases.log" | tac | awk '!seen[$0]++' | head -n "$keep")
# The live release and the rollback target are always kept, however old.
kept_tags+=("$TAG" "${PREVIOUS_TAG:-$TAG}")
prefix="$(env_get "$SHARED_DIR/.env" REGISTRY)/$(env_get "$SHARED_DIR/.env" IMAGE_NAMESPACE)"
for dir in "$DEPLOY_ROOT"/releases/*/; do
  old="$(basename "$dir")"
  if ! printf '%s\n' "${kept_tags[@]}" | grep -qxF "$old"; then
    rm -rf "${DEPLOY_ROOT:?}/releases/$old"
    for repo in api api-migrate frontend; do
      docker image rm "$prefix/$repo:$old" >/dev/null 2>&1 || true
    done
    log "removed old release $old"
  fi
done
docker image prune -f >/dev/null || true

log "deployed $TAG"
notify "Deployed ${TAG:0:12} to $(env_get "$SHARED_DIR/.env" DOMAIN)"
