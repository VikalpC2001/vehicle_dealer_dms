#!/usr/bin/env bash
# Checks the stack is healthy. Exit 0 = healthy, 1 = a check failed. Run as the deploy user; the
# systemd timer (systemd/dcarjt-health.timer) runs it every 15 minutes and posts failures to
# ALERT_WEBHOOK_URL when set.
#
#   health-check.sh            containers, database, API, web app through nginx, disk, backups
#   health-check.sh --deploy   the same without the disk and backup checks (used right after a deploy)
#
# Checks wait up to 30–90 s for services that are still starting; HEALTH_WAIT_SECONDS=<n> shortens that.
LOG_TAG=health
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DEPLOY_MODE=false
[[ "${1:-}" == "--deploy" ]] && DEPLOY_MODE=true

# An unexpected error in this script must still be visible (and alerted), never a silent exit.
on_error() {
  local status=$? line="$1"
  log "health check aborted by an error on line $line (exit $status)"
  [[ "$DEPLOY_MODE" == true ]] || notify "Health check script failed on $(hostname) (line $line)"
}
trap 'on_error $LINENO' ERR

require_cmd docker curl
export IMAGE_TAG="${IMAGE_TAG:-$(current_tag)}"
[[ -n "$IMAGE_TAG" ]] || die "nothing deployed yet"

failures=()
fail() { failures+=("$*"); log "FAIL: $*"; }
ok() { log "ok: $*"; }

# Retries a check for up to $1 seconds (containers that were just started need a moment).
retry_for() {
  local seconds="$1" end
  shift
  end=$((SECONDS + seconds))
  until "$@"; do
    ((SECONDS < end)) || return 1
    sleep 3
  done
}

# ── Containers ───────────────────────────────────────────────────────────────────────────────────
container_healthy() {
  local id state health
  id="$(dc ps -q "$1" 2>/dev/null)"
  [[ -n "$id" ]] || return 1
  state="$(docker inspect -f '{{.State.Status}}' "$id")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
  [[ "$state" == running && ("$health" == healthy || "$health" == none) ]]
}
for service in postgres api frontend nginx; do
  if retry_for "${HEALTH_WAIT_SECONDS:-90}" container_healthy "$service"; then ok "$service container running and healthy"; else fail "$service container is not running/healthy"; fi
done

# ── Database and API (inside the stack) ──────────────────────────────────────────────────────────
if dc exec -T postgres sh -c 'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; then ok "PostgreSQL accepts connections"; else fail "PostgreSQL is not ready"; fi

api_ready() {
  dc exec -T api node -e "fetch('http://127.0.0.1:4002/api/v1/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
}
if retry_for "${HEALTH_WAIT_SECONDS:-60}" api_ready; then ok "API ready (database reachable from the API)"; else fail "API readiness check failed"; fi

# ── Through nginx, as Cloudflare reaches it (origin certificate; -k because it is not publicly trusted) ─
domain="$(env_require "$SHARED_DIR/.env" DOMAIN)"
api_domain="$(env_require "$SHARED_DIR/.env" API_DOMAIN)"
www_domain="$(env_get "$SHARED_DIR/.env" WWW_DOMAIN || true)"
https_port="$(env_get "$SHARED_DIR/.env" HTTPS_PORT || echo 443)"
http_port="$(env_get "$SHARED_DIR/.env" HTTP_PORT || echo 80)"
curl_origin() { # host path → prints "status" ; extra curl args after
  local host="$1" path="$2"
  shift 2
  curl -ksS -o /dev/null -w '%{http_code}' --max-time 15 \
    --resolve "$host:$https_port:127.0.0.1" "https://$host:$https_port$path" "$@"
}

web_ok() { [[ "$(curl_origin "$domain" /)" == 200 ]]; }
if retry_for "${HEALTH_WAIT_SECONDS:-30}" web_ok; then ok "web app served at https://$domain/"; else fail "https://$domain/ did not return 200"; fi
route_status="$(curl_origin "$domain" /dealer/dashboard || true)"
if [[ "$route_status" == 200 ]]; then ok "client-side routes fall back to the app shell"; else fail "https://$domain/dealer/dashboard returned $route_status (expected 200)"; fi
api_status="$(curl_origin "$api_domain" /api/v1/health/ready || true)"
if [[ "$api_status" == 200 ]]; then ok "API ready at https://$api_domain/api/v1/health/ready"; else fail "https://$api_domain/api/v1/health/ready returned $api_status"; fi
if [[ -n "$www_domain" ]]; then
  www_status="$(curl_origin "$www_domain" / || true)"
  if [[ "$www_status" == 301 ]]; then ok "www redirects to the apex domain"; else fail "https://$www_domain/ returned $www_status (expected 301)"; fi
fi
http_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$domain:$http_port:127.0.0.1" "http://$domain:$http_port/" || true)"
if [[ "$http_status" == 301 ]]; then ok "HTTP redirects to HTTPS"; else fail "http://$domain/ returned $http_status (expected 301)"; fi

# ── Disk, memory and backups (not right after a deploy) ──────────────────────────────────────────
if [[ "$DEPLOY_MODE" != true ]]; then
  warn_percent="$(env_get "$SHARED_DIR/.env" DISK_WARN_PERCENT || echo 85)"
  [[ "$warn_percent" =~ ^[0-9]+$ ]] || warn_percent=85
  docker_root="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
  for path in / "$DEPLOY_ROOT" "$docker_root"; do
    used="$(df -P "$path" 2>/dev/null | awk 'NR==2 {gsub("%", "", $5); print $5}' || true)"
    [[ "$used" =~ ^[0-9]+$ ]] || continue
    if ((used >= warn_percent)); then fail "disk for $path is ${used}% full (limit ${warn_percent}%) — see: docker system df"; else ok "disk for $path ${used}% used"; fi
  done

  available_mb="$(awk '/MemAvailable/ {print int($2 / 1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  total_mb="$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  if ((total_mb > 0 && available_mb * 10 < total_mb)); then fail "only ${available_mb} MB of ${total_mb} MB memory available"; else ok "memory: ${available_mb} MB of ${total_mb} MB available"; fi

  if [[ -f "$STATE_DIR/last_backup.json" ]]; then
    age_hours=$((($(date +%s) - $(stat -c %Y "$STATE_DIR/last_backup.json")) / 3600))
    if ((age_hours > 26)); then fail "last backup is ${age_hours} h old"; else ok "last backup ${age_hours} h ago"; fi
  else
    fail "no backup has been taken yet (scripts/backup-postgres.sh)"
  fi
fi

if ((${#failures[@]})); then
  [[ "$DEPLOY_MODE" == true ]] || notify "Health check failed on $(hostname): ${failures[*]}"
  log "${#failures[@]} check(s) failed"
  exit 1
fi
log "all checks passed"
