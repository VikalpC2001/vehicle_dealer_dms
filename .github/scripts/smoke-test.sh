#!/usr/bin/env bash
# Full-stack smoke test, run by .github/workflows/ci.yml on a GitHub runner. Exercises the REAL deploy
# scripts in the same layout as the server, against images built in the same CI job:
#
#   ci.local/dcarjt/api:ci-1, ci.local/dcarjt/api-migrate:ci-1, ci.local/dcarjt/frontend:ci-1
#
# configure → first deploy → bootstrap (+ promotion guard) → edge checks → upgrade (detached runner) →
# redeploy through current/ after a settings change → PostgreSQL major-version guard → rollback →
# broken deploy (must roll back by itself) → backup → restore check → live restores → API/nginx down →
# release pruning → rate limits.
# Uses throwaway names (project dcarjtci, ports 18080/18443, domain dcarjt.test); never run it on a server.
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DEPLOY_ROOT="${RUNNER_TEMP:?run this in CI}/dcarjt"
SHARED="$DEPLOY_ROOT/shared"
DOMAIN=dcarjt.test
API_DOMAIN="api.$DOMAIN"
HTTP_PORT=18080
HTTPS_PORT=18443
IMAGES=ci.local/dcarjt
DC="$DEPLOY_ROOT/current/scripts/dc.sh"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
pass() { printf 'PASS: %s\n' "$*"; }
fail() {
  printf '::error::%s\n' "$*"
  exit 1
}

# KEY=value replacement in an env file (first occurrence; value taken literally; appended if missing).
set_kv() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" 'BEGIN { done = 0 } $0 ~ "^" k "=" && !done { print k "=" v; done = 1; next } { print } END { if (!done) print k "=" v }' "$file" >"$tmp"
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

# A release directory as the deploy workflow creates it (copy of deploy/).
release() {
  rm -rf "$DEPLOY_ROOT/releases/$1"
  mkdir -p "$DEPLOY_ROOT/releases"
  cp -a "$REPO/deploy" "$DEPLOY_ROOT/releases/$1"
}

tag_images() { # from to
  local repo
  for repo in api api-migrate frontend; do docker tag "$IMAGES/$repo:$1" "$IMAGES/$repo:$2"; done
}

state() { cat "$SHARED/state/$1"; }
api_image() { docker inspect -f '{{.Config.Image}}' "$("$DC" ps -q api)"; }

# curl to the edge nginx as Cloudflare would reach it (origin certificate is self-signed here).
edge() { # host path [curl args…]
  local host="$1" path="$2"
  shift 2
  curl -ksS --max-time 20 --resolve "$host:$HTTPS_PORT:127.0.0.1" "https://$host:$HTTPS_PORT$path" "$@"
}

login() { # email password → status; response in $RUNNER_TEMP/login.json
  edge "$API_DOMAIN" /api/v1/auth/login -H 'Content-Type: application/json' -H "Origin: https://$DOMAIN" \
    -D "$RUNNER_TEMP/login.headers" -o "$RUNNER_TEMP/login.json" -w '%{http_code}' \
    --data "{\"email\":\"$1\",\"password\":\"$2\"}"
}

count_429() { # n method path [curl args…]
  local n="$1" method="$2" path="$3" c=0
  shift 3
  for _ in $(seq 1 "$n"); do
    [[ "$(edge "$API_DOMAIN" "$path" -X "$method" -o /dev/null -w '%{http_code}' "$@")" == 429 ]] && c=$((c + 1))
  done
  echo "$c"
}

psql_db() { # SQL from stdin, run in the app database; extra args are psql -v assignments
  "$DC" exec -T postgres sh -c 'psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@" -f -' sh "$@"
}

rm -rf "$DEPLOY_ROOT"
mkdir -p "$SHARED"

# ── Configure ────────────────────────────────────────────────────────────────────────────────────
step "configure-server.sh (first run must report the missing values)"
release ci-1
if "$DEPLOY_ROOT/releases/ci-1/scripts/configure-server.sh" --registry ci.local --image-namespace dcarjt --domain "$DOMAIN"; then
  fail "configure-server.sh accepted an incomplete configuration"
fi
for f in api.env postgres.env; do
  [[ "$(stat -c '%a' "$SHARED/$f")" == 600 ]] || fail "$f is not chmod 600"
done
grep -q '^JWT_SECRET=[0-9a-f]\{64\}$' "$SHARED/api.env" || fail "JWT secret was not generated"
grep -q "^DEPLOY_GID=$(id -g)$" "$SHARED/.env" || fail "DEPLOY_GID was not set"
pass "configuration generated with private secrets"

set_kv "$SHARED/.env" COMPOSE_PROJECT_NAME dcarjtci
set_kv "$SHARED/.env" POSTGRES_VOLUME dcarjtci_postgres
set_kv "$SHARED/.env" UPLOADS_VOLUME dcarjtci_uploads
set_kv "$SHARED/.env" HTTP_PORT "$HTTP_PORT"
set_kv "$SHARED/.env" HTTPS_PORT "$HTTPS_PORT"
set_kv "$SHARED/.env" RELEASES_TO_KEEP 2
set_kv "$SHARED/.env" DISK_WARN_PERCENT 99
set_kv "$SHARED/api.env" GEMINI_API_KEY ci-not-used
set_kv "$SHARED/api.env" SMTP_HOST localhost
set_kv "$SHARED/api.env" SMTP_USER ci
set_kv "$SHARED/api.env" SMTP_PASS ci
set_kv "$SHARED/api.env" EMAIL_FROM "ci@$DOMAIN"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN" \
  -keyout "$SHARED/certs/origin.key" -out "$SHARED/certs/origin.crt" 2>/dev/null
chmod 600 "$SHARED/certs/origin.key"

step "configure-server.sh (second run, no flags: uses the saved domains and fixes the key permissions)"
"$DEPLOY_ROOT/releases/ci-1/scripts/configure-server.sh" | tee "$RUNNER_TEMP/configure-2.txt"
[[ "$(stat -c '%a %g' "$SHARED/certs/origin.key")" == "640 $(id -g)" ]] || fail "key permissions not fixed"
if grep -q 'does not cover' "$RUNNER_TEMP/configure-2.txt"; then fail "the saved domains were not used for the certificate check"; fi
pass "configuration complete"

# ── First deploy ─────────────────────────────────────────────────────────────────────────────────
step "first deploy (ci-1)"
"$DEPLOY_ROOT/releases/ci-1/scripts/deploy.sh" ci-1 --no-pull
[[ "$(state current_release)" == ci-1 ]] || fail "current_release is not ci-1"
[[ "$(readlink "$DEPLOY_ROOT/current")" == "$DEPLOY_ROOT/releases/ci-1" ]] || fail "current symlink is wrong"
compgen -G "$SHARED/backups/postgres/*-first-deploy.dump" >/dev/null || fail "no first-deploy backup"
pass "deployed, recorded, baseline backup taken"

step "nothing but nginx is published on the host"
for service in postgres api frontend; do
  published="$(docker port "$("$DC" ps -q "$service")" || true)"
  [[ -z "$published" ]] || fail "$service publishes ports: $published"
done
pass "postgres, api and frontend have no published ports"

# ── Bootstrap ────────────────────────────────────────────────────────────────────────────────────
step "bootstrap (geography, super-admin, document categories) — twice, must be idempotent"
admin_email="admin@$DOMAIN"
admin_password="$(openssl rand -hex 16)"
for _ in 1 2; do
  BOOTSTRAP_ADMIN_EMAIL="$admin_email" BOOTSTRAP_ADMIN_NAME="CI Admin" BOOTSTRAP_ADMIN_MOBILE=9999999999 \
    BOOTSTRAP_ADMIN_PASSWORD="$admin_password" "$DEPLOY_ROOT/current/scripts/bootstrap.sh"
done
pass "bootstrap ran twice"

step "bootstrap never silently promotes an account someone else registered"
owner_email="owner@$DOMAIN"
owner_password="$(openssl rand -hex 16)"
psql_db -v email="$owner_email" <<'SQL'
INSERT INTO users (user_name, password, email_id, mobile_no, modification_date)
VALUES ('Stranger', 'not-a-bcrypt-hash', :'email', '9000000000', now());
SQL
if BOOTSTRAP_ADMIN_EMAIL="$owner_email" BOOTSTRAP_ADMIN_NAME="Owner" BOOTSTRAP_ADMIN_MOBILE=9999999998 \
  BOOTSTRAP_ADMIN_PASSWORD="$owner_password" "$DEPLOY_ROOT/current/scripts/bootstrap.sh"; then
  fail "bootstrap promoted an ordinary account without being asked"
fi
BOOTSTRAP_ADMIN_PROMOTE_EXISTING=true BOOTSTRAP_ADMIN_EMAIL="$owner_email" BOOTSTRAP_ADMIN_NAME="Owner" \
  BOOTSTRAP_ADMIN_MOBILE=9999999998 BOOTSTRAP_ADMIN_PASSWORD="$owner_password" "$DEPLOY_ROOT/current/scripts/bootstrap.sh"
[[ "$(login "$owner_email" "$owner_password")" == 200 ]] || fail "the promoted account does not sign in with the new password"
pass "refused without BOOTSTRAP_ADMIN_PROMOTE_EXISTING; with it, promoted and the password replaced"

step "super-admin login through nginx (CORS for the web app origin)"
[[ "$(login "$admin_email" "$admin_password")" == 200 ]] || fail "login failed: $(cat "$RUNNER_TEMP/login.json")"
grep -q '"token":"' "$RUNNER_TEMP/login.json" || fail "no token in the login response"
grep -qi "^access-control-allow-origin: https://$DOMAIN" "$RUNNER_TEMP/login.headers" || fail "CORS header missing for https://$DOMAIN"
pass "login works, CORS allows https://$DOMAIN"

step "edge behaviour"
headers="$(edge "$DOMAIN" / -D - -o "$RUNNER_TEMP/index.html")"
grep -qi '^strict-transport-security: max-age=' <<<"$headers" || fail "HSTS header missing"
grep -qi '^x-content-type-options: nosniff' <<<"$headers" || fail "nosniff header missing"
grep -q '<div id="root">' "$RUNNER_TEMP/index.html" || fail "the web app shell was not served"
asset="$(grep -o '/assets/[^"]*\.js' "$RUNNER_TEMP/index.html" | head -n 1 || true)"
[[ -n "$asset" ]] || fail "no script asset in index.html"
asset_headers="$(edge "$DOMAIN" "$asset" -D - -o /dev/null)"
grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$asset_headers" || fail "assets are not cached immutably"
docker run --rm --network none --entrypoint grep "$IMAGES/frontend:ci-1" -rlq "https://$API_DOMAIN/api/v1" /usr/share/nginx/html/assets ||
  fail "the frontend was not built with the API URL"
[[ "$(edge "www.$DOMAIN" '/x?y=1' -o /dev/null -w '%{redirect_url}')" == "https://$DOMAIN/x?y=1" ]] || fail "www does not redirect to the apex"
[[ "$(curl -sS -o /dev/null -w '%{redirect_url}' --resolve "$DOMAIN:$HTTP_PORT:127.0.0.1" "http://$DOMAIN:$HTTP_PORT/a")" == "https://$DOMAIN/a" ]] || fail "HTTP does not redirect to HTTPS"
if curl -ksS -o /dev/null --max-time 10 --resolve "unknown.example:$HTTPS_PORT:127.0.0.1" "https://unknown.example:$HTTPS_PORT/" 2>/dev/null; then
  fail "an unknown host name got a TLS response"
fi
uploads_headers="$(edge "$API_DOMAIN" /uploads/does-not-exist.pdf -D - -o /dev/null)"
grep -qi '^cross-origin-resource-policy: same-site' <<<"$uploads_headers" || fail "uploads are not served with CORP same-site"
grep -qi "^content-security-policy:.*frame-ancestors 'self' https://$DOMAIN" <<<"$uploads_headers" || fail "the web app may not embed uploaded PDFs"
if grep -qi '^x-frame-options' <<<"$uploads_headers"; then fail "uploads still send X-Frame-Options"; fi
tz="$("$DC" exec -T api node -e 'console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)' | tr -d '\r')"
[[ "$tz" == Asia/Kolkata || "$tz" == Asia/Calcutta ]] || fail "the API does not use the business time zone (got $tz)"
pass "HSTS, nosniff, SPA shell, immutable assets, API URL, redirects, unknown hosts refused, uploads embeddable, API time zone $tz"

# ── Upgrade ──────────────────────────────────────────────────────────────────────────────────────
step "upgrade (ci-2) through the detached runner, as the deploy workflow does"
tag_images ci-1 ci-2
release ci-2
"$DEPLOY_ROOT/releases/ci-2/scripts/run-deploy.sh" ci-2 --no-pull
[[ "$(state current_release) $(state previous_release)" == "ci-2 ci-1" ]] || fail "release state after upgrade is wrong"
[[ "$(api_image)" == "$IMAGES/api:ci-2" ]] || fail "api is not running ci-2"
compgen -G "$SHARED/backups/postgres/*-pre-deploy-ci-2.dump" >/dev/null || fail "no pre-deploy backup"
if compgen -G "$SHARED/backups/uploads/*-pre-deploy-*" >/dev/null; then fail "the pre-deploy backup archived the uploads too"; fi
compgen -G "$SHARED/state/deploys/*-ci-2.log.status" >/dev/null || fail "run-deploy.sh did not record the result"
pass "upgraded to ci-2 (database-only pre-deploy backup, detached run recorded)"

step "settings change re-deployed through current/: no symlink loop, nginx recreated"
nginx_before="$("$DC" ps -q nginx)"
set_kv "$SHARED/.env" NGINX_MEMORY_LIMIT 300m
"$DEPLOY_ROOT/current/scripts/deploy.sh" ci-2 --no-pull --skip-migrations --no-backup
[[ "$(readlink "$DEPLOY_ROOT/current")" == "$DEPLOY_ROOT/releases/ci-2" ]] || fail "current points to $(readlink "$DEPLOY_ROOT/current")"
[[ -f "$DEPLOY_ROOT/current/scripts/backup-postgres.sh" ]] || fail "current/ no longer resolves"
nginx_after="$("$DC" ps -q nginx)"
[[ "$nginx_before" != "$nginx_after" ]] || fail "nginx was not recreated after its settings changed"
[[ "$(docker inspect -f '{{.HostConfig.Memory}}' "$nginx_after")" == $((300 * 1024 * 1024)) ]] || fail "nginx did not get the new memory limit"
pass "current -> releases/ci-2, nginx recreated with the new limit"

step "a PostgreSQL major-version change is refused before anything changes"
postgres_before="$("$DC" ps -q postgres)"
set_kv "$SHARED/.env" POSTGRES_IMAGE postgres:17-alpine
if "$DEPLOY_ROOT/current/scripts/deploy.sh" ci-2 --no-pull --skip-migrations --no-backup >"$RUNNER_TEMP/major.txt" 2>&1; then
  cat "$RUNNER_TEMP/major.txt"
  fail "a deploy switching PostgreSQL 18 → 17 went through"
fi
cat "$RUNNER_TEMP/major.txt"
grep -q 'major upgrade needs a dump and restore' "$RUNNER_TEMP/major.txt" || fail "no clear major-version message"
sed -i '/^POSTGRES_IMAGE=/d' "$SHARED/.env"
[[ "$("$DC" ps -q postgres)" == "$postgres_before" ]] || fail "the postgres container was replaced"
pass "refused; PostgreSQL untouched"

step "rollback to the previous release"
"$DEPLOY_ROOT/current/scripts/rollback.sh" --yes
[[ "$(state current_release) $(state previous_release)" == "ci-1 ci-2" ]] || fail "release state after rollback is wrong"
[[ "$(api_image)" == "$IMAGES/api:ci-1" ]] || fail "api is not running ci-1 after rollback"
pass "rolled back to ci-1"

step "broken release: the deploy must fail and put ci-1 back by itself"
container="$(docker create "$IMAGES/api:ci-1")"
# Runs, but never answers the health check.
docker commit --change 'CMD ["node", "-e", "setInterval(() => {}, 1 << 30)"]' "$container" "$IMAGES/api:ci-bad" >/dev/null
docker rm "$container" >/dev/null
docker tag "$IMAGES/api-migrate:ci-1" "$IMAGES/api-migrate:ci-bad"
docker tag "$IMAGES/frontend:ci-1" "$IMAGES/frontend:ci-bad"
release ci-bad
status=0
"$DEPLOY_ROOT/releases/ci-bad/scripts/run-deploy.sh" ci-bad --no-pull --no-backup >"$RUNNER_TEMP/bad-deploy.txt" 2>&1 || status=$?
cat "$RUNNER_TEMP/bad-deploy.txt"
((status != 0)) || fail "the broken release was deployed"
[[ "$(state current_release)" == ci-1 ]] || fail "current_release changed after a failed deploy"
[[ "$(api_image)" == "$IMAGES/api:ci-1" ]] || fail "ci-1 was not put back after the failed deploy"
if grep -q 'cf_ray=' "$RUNNER_TEMP/bad-deploy.txt"; then fail "nginx access logs were printed into the deploy output"; fi
[[ "$(stat -c '%a' "$SHARED/state/deploy-ci-bad-failure.log")" == 600 ]] || fail "the failure log is missing or readable by others"
"$DEPLOY_ROOT/current/scripts/health-check.sh" --deploy
pass "failed deploy rolled back automatically; container logs kept on the server only"

# ── Backups ──────────────────────────────────────────────────────────────────────────────────────
step "backup + restore check"
"$DEPLOY_ROOT/current/scripts/backup-postgres.sh" --label ci
dump="$(compgen -G "$SHARED/backups/postgres/*-ci.dump")"
uploads="$(compgen -G "$SHARED/backups/uploads/*-ci.tar.gz")"
(cd "$(dirname "$dump")" && sha256sum -c "$(basename "$dump").sha256")
"$DEPLOY_ROOT/current/scripts/restore-postgres.sh" "$dump" --check | tee "$RUNNER_TEMP/restore-check.txt"
grep -Eq '^users [1-9]' "$RUNNER_TEMP/restore-check.txt" || fail "the restored copy has no users"
pass "backup verified by a full restore into a temporary database"

step "live restore (database + uploads)"
"$DEPLOY_ROOT/current/scripts/restore-postgres.sh" "$dump" --live --uploads "$uploads" --yes
databases="$("$DC" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT datname FROM pg_database"')"
grep -q '_before_restore_' <<<"$databases" || fail "the replaced database was not kept"
[[ "$(login "$admin_email" "$admin_password")" == 200 ]] || fail "login failed after the live restore"
pass "live restore swapped the database in and the API came back"

step "live restore without migrations (going back before a migration)"
"$DEPLOY_ROOT/current/scripts/restore-postgres.sh" "$dump" --live --skip-migrations --yes | tee "$RUNNER_TEMP/restore-skip.txt"
grep -q 'migrations skipped' "$RUNNER_TEMP/restore-skip.txt" || fail "--skip-migrations was not honoured"
[[ "$(login "$admin_email" "$admin_password")" == 200 ]] || fail "login failed after the second live restore"
if compgen -G "$SHARED/restore-work/*" >/dev/null; then fail "the restore work area was not cleaned up"; fi
pass "restored without migrations"

step "full health check (as the systemd timer runs it)"
"$DEPLOY_ROOT/current/scripts/health-check.sh"

# ── Failure behaviour at the edge ────────────────────────────────────────────────────────────────
step "API down: nginx answers JSON 503 (readable by the web app) and CORS preflights"
"$DC" stop api
body="$(edge "$API_DOMAIN" /api/v1/health -H "Origin: https://$DOMAIN" -D "$RUNNER_TEMP/503.headers" -w ' %{http_code}')"
preflight="$(edge "$API_DOMAIN" /api/v1/auth/login -X OPTIONS -H "Origin: https://$DOMAIN" \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' -D - -o /dev/null)"
"$DC" up -d --wait --wait-timeout 180 api
[[ "$body" == *'"success":false'*' 503' ]] || fail "expected a JSON 503, got: $body"
grep -qi "^access-control-allow-origin: https://$DOMAIN" "$RUNNER_TEMP/503.headers" || fail "the 503 has no CORS header"
grep -q '^HTTP/[0-9.]* 204' <<<"$preflight" || fail "the preflight did not get 204 while the API was down"
grep -qi "^access-control-allow-origin: https://$DOMAIN" <<<"$preflight" || fail "the preflight has no CORS header"
pass "JSON 503 with CORS, preflight answered"

step "nginx down: the health check reports failures (it must not crash)"
"$DC" stop nginx
status=0
HEALTH_WAIT_SECONDS=3 "$DEPLOY_ROOT/current/scripts/health-check.sh" >"$RUNNER_TEMP/health-down.txt" 2>&1 || status=$?
"$DC" up -d --wait --wait-timeout 60 nginx
cat "$RUNNER_TEMP/health-down.txt"
[[ "$status" == 1 ]] || fail "health check exited $status with nginx down (expected 1)"
grep -q 'FAIL: nginx container' "$RUNNER_TEMP/health-down.txt" || fail "the stopped nginx was not reported"
grep -q 'check(s) failed' "$RUNNER_TEMP/health-down.txt" || fail "the health check did not finish its report"
if grep -q 'aborted by an error' "$RUNNER_TEMP/health-down.txt"; then fail "the health check crashed instead of reporting"; fi
pass "failures reported, exit 1, no crash"

# ── Release pruning ──────────────────────────────────────────────────────────────────────────────
step "two more deploys: old releases and their images are pruned, live and rollback releases kept"
for tag in ci-3 ci-4; do
  tag_images ci-1 "$tag"
  release "$tag"
  "$DEPLOY_ROOT/releases/$tag/scripts/deploy.sh" "$tag" --no-pull
done
ls "$DEPLOY_ROOT/releases"
[[ "$(find "$DEPLOY_ROOT/releases" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort | tr '\n' ' ')" == "ci-3 ci-4 " ]] ||
  fail "expected only the ci-3 and ci-4 release directories"
for gone in ci-1 ci-2 ci-bad; do
  if docker image inspect "$IMAGES/api:$gone" >/dev/null 2>&1; then fail "image api:$gone was not pruned"; fi
done
docker image inspect "$IMAGES/api:ci-3" "$IMAGES/api:ci-4" >/dev/null || fail "a kept release lost its image"
[[ "$(state current_release) $(state previous_release)" == "ci-4 ci-3" ]] || fail "release state after pruning is wrong"
archives="$(find "$SHARED/backups/uploads" -maxdepth 1 -name 'uploads-*.tar.gz' | wc -l)"
((archives <= 3)) || fail "$archives upload archives kept (expected at most 3)"
pass "releases ci-3/ci-4 kept, older ones and their images removed; $archives upload archives kept"

# ── Rate limits (last: they use up this client's budget) ─────────────────────────────────────────
step "rate limits"
[[ "$(count_429 40 GET /api/v1/auth/me)" == 0 ]] || fail "the session heartbeat was rate limited"
[[ "$(count_429 40 POST /api/v1/auth/refresh -H 'Content-Type: application/json' --data '{}')" == 0 ]] || fail "token refresh was rate limited"
[[ "$(count_429 40 OPTIONS /api/v1/auth/login -H "Origin: https://$DOMAIN" -H 'Access-Control-Request-Method: POST')" == 0 ]] ||
  fail "CORS preflights were rate limited"
limited="$(count_429 40 POST /api/v1/Auth/Login -H 'Content-Type: application/json' --data '{}')"
((limited > 0)) || fail "40 rapid sign-in attempts (mixed-case path) were not rate limited"
registration_limited="$(count_429 5 POST /api/v1/registrations -H 'Content-Type: application/json' --data '{}')"
((registration_limited >= 3)) || fail "self-registration is not rate limited ($registration_limited of 5)"
# The first 429 a visitor gets must be the JSON error, readable by the web app.
got_429=false
for _ in $(seq 1 40); do
  code="$(edge "$API_DOMAIN" /api/v1/auth/login -X POST -H "Origin: https://$DOMAIN" -H 'Content-Type: application/json' \
    --data '{}' -D "$RUNNER_TEMP/429.headers" -o "$RUNNER_TEMP/429.json" -w '%{http_code}')"
  if [[ "$code" == 429 ]]; then got_429=true; break; fi
done
[[ "$got_429" == true ]] || fail "no 429 after 40 more sign-in attempts"
grep -q '"statusCode":429' "$RUNNER_TEMP/429.json" || fail "the 429 is not the JSON error"
grep -qi "^access-control-allow-origin: https://$DOMAIN" "$RUNNER_TEMP/429.headers" || fail "the 429 has no CORS header"
pass "heartbeat/refresh/preflights unlimited; $limited of 40 sign-ins limited (any letter case); registration limited; JSON 429 with CORS"

printf '\n\033[1mSmoke test passed.\033[0m\n'
