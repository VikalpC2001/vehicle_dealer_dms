#!/usr/bin/env bash
# Restores a database backup made by backup-postgres.sh. Run as the deploy user.
#
#   restore-postgres.sh <file.dump[.gpg]> --check
#       Restores into a temporary database next to the live one, prints row counts, then drops it.
#       Changes nothing else — run it regularly to prove the backups work.
#
#   restore-postgres.sh <file.dump[.gpg]> --live [--uploads <uploads-….tar.gz[.gpg]>] [--skip-migrations] [--yes]
#       REPLACES the live database (and, with --uploads, the uploaded files). Takes a safety backup,
#       restores into a new database, then swaps it in while the API is stopped; the old database is
#       kept under another name until you drop it. Then applies the LIVE release's migrations, unless
#       --skip-migrations (use that when going back to before a migration: roll the code back first).
#
# Input files are verified (a .sha256 is required for --live) before anything changes. Keep them
# outside shared/backups when restoring from elsewhere (e.g. /opt/dcarjt/shared/restore/).
LOG_TAG=restore
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FILE=""
MODE=""
UPLOADS=""
ASSUME_YES=false
MIGRATE=true
while (($#)); do
  case "$1" in
    --check) MODE=check ;;
    --live) MODE=live ;;
    --uploads) UPLOADS="${2:-}"; shift ;;
    --skip-migrations) MIGRATE=false ;;
    --yes | -y) ASSUME_YES=true ;;
    -h | --help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown option $1" ;;
    *) FILE="$1" ;;
  esac
  shift
done
[[ -n "$FILE" && -n "$MODE" ]] || die "usage: restore-postgres.sh <backup file> --check | --live (see --help)"
[[ -f "$FILE" ]] || die "no such file: $FILE"
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || die "no such file: $UPLOADS"
[[ "$MODE" == live || -z "$UPLOADS" ]] || die "--uploads is only used with --live"
[[ "$MODE" == live || "$MIGRATE" == true ]] || die "--skip-migrations is only used with --live"

require_cmd docker sha256sum
export IMAGE_TAG="${IMAGE_TAG:-$(current_tag)}"
[[ -n "$IMAGE_TAG" ]] || IMAGE_TAG="none"
[[ -n "$(dc ps --status running -q postgres 2>/dev/null)" ]] || die "the postgres container is not running"

passphrase_file="$(env_get "$SHARED_DIR/.env" BACKUP_PASSPHRASE_FILE || true)"
# Work area on the same disk as the backups. Inputs are pinned here first (hard link, or decrypted
# copy), so the retention clean-up of the safety backup can never remove them halfway.
WORK="$SHARED_DIR/restore-work/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$WORK"
chmod 700 "$SHARED_DIR/restore-work" "$WORK"
trap 'rm -rf "$WORK"' EXIT

# Verifies the checksum (required for --live), decrypts when needed and pins the input in $WORK;
# prints the plain file to use.
prepare() {
  local file="$1" name out
  name="$(basename "$file")"
  if [[ -f "$file.sha256" ]]; then
    (cd "$(dirname "$file")" && sha256sum --quiet -c "$name.sha256") || die "checksum mismatch for $file"
  elif [[ "$MODE" == live ]]; then
    die "no checksum file $file.sha256. If you trust the file, create one: (cd $(dirname "$file") && sha256sum $name >$name.sha256)"
  else
    warn "no checksum file for $file"
  fi
  if [[ "$file" == *.gpg ]]; then
    require_cmd gpg
    [[ -n "$passphrase_file" && -r "$passphrase_file" ]] || die "$file is encrypted; set BACKUP_PASSPHRASE_FILE in $SHARED_DIR/.env"
    out="$WORK/${name%.gpg}"
    gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$passphrase_file" --output "$out" --decrypt "$file" ||
      die "could not decrypt $file (is BACKUP_PASSPHRASE_FILE the one used for the backup?)"
  else
    out="$WORK/$name"
    ln "$file" "$out" 2>/dev/null || cp "$file" "$out"
  fi
  printf '%s' "$out"
}

# ── Verify every input before anything changes ───────────────────────────────────────────────────
DUMP="$(prepare "$FILE")"
dc exec -T postgres pg_restore --list <"$DUMP" >/dev/null || die "$FILE is not a readable pg_dump archive"
if [[ -n "$UPLOADS" ]]; then
  ARCHIVE="$(prepare "$UPLOADS")"
  postgres_image="$(service_image postgres)" || die "could not determine the postgres image from compose.yaml"
  docker run --rm -i --network none --entrypoint tar "$postgres_image" -tzf - <"$ARCHIVE" >/dev/null ||
    die "$UPLOADS is not a complete .tar.gz archive"
fi

if [[ "$MODE" == check ]]; then
  scratch="restore_check_$(date -u +%Y%m%d%H%M%S)"
  log "restoring into temporary database $scratch"
  dc exec -T -e SCRATCH="$scratch" postgres sh -c 'createdb -U "$POSTGRES_USER" "$SCRATCH"'
  # Always drop the temporary database, also when the restore fails.
  # shellcheck disable=SC2329 # invoked by the EXIT trap
  cleanup_check() { dc exec -T -e SCRATCH="$scratch" postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$SCRATCH"' || true; rm -rf "$WORK"; }
  trap cleanup_check EXIT
  dc exec -T -e SCRATCH="$scratch" postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$SCRATCH" --no-owner --exit-on-error' <"$DUMP"
  log "restored; row counts:"
  dc exec -T -e SCRATCH="$scratch" postgres sh -c 'psql -U "$POSTGRES_USER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -At -F " " -c "
    SELECT '"'"'users'"'"', count(*) FROM users
    UNION ALL SELECT '"'"'dealers'"'"', count(*) FROM dealers
    UNION ALL SELECT '"'"'agents'"'"', count(*) FROM agents
    UNION ALL SELECT '"'"'vehicle_process'"'"', count(*) FROM vehicle_process
    UNION ALL SELECT '"'"'ledger_entry'"'"', count(*) FROM ledger_entry
    UNION ALL SELECT '"'"'migrations'"'"', count(*) FROM _prisma_migrations"'
  log "check passed: $FILE restores cleanly (temporary database dropped)"
  exit 0
fi

# ── Live restore ─────────────────────────────────────────────────────────────────────────────────
db_name="$(env_require "$SHARED_DIR/postgres.env" POSTGRES_DB)"
warn "this REPLACES the live database '$db_name'${UPLOADS:+ and the uploaded files} with $FILE"
if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type the database name ($db_name) to continue: " answer
  [[ "$answer" == "$db_name" ]] || die "not confirmed"
fi

exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "a deploy or rollback is running"

log "safety backup of the current state first"
"$SCRIPT_DIR/backup-postgres.sh" --label pre-restore --skip-offsite

# 1. Restore into a NEW database next to the live one; a failure here changes nothing.
stamp="$(date -u +%Y%m%d%H%M%S)"
incoming="${db_name}_incoming_$stamp"
kept="${db_name}_before_restore_$stamp"
((${#kept} <= 63)) || die "database name $db_name is too long for the restore names"
log "restoring into new database $incoming"
dc exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$incoming"
if ! dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error --single-transaction' sh "$incoming" <"$DUMP"; then
  dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$incoming" || true
  die "the restore failed; the live database was not changed"
fi

# 2. Swap names in one transaction while the API is stopped. The old data stays as $kept.
restart_api() { dc up -d --wait --wait-timeout 180 api || warn "the API did not come back healthy; check: scripts/dc.sh logs --tail=200 api"; }
trap 'restart_api; rm -rf "$WORK"' EXIT
log "stopping the API"
dc stop api
log "switching $db_name to the restored data (current data kept as $kept)"
dc exec -T postgres sh -c 'psql -X -q -o /dev/null -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -v live="$1" -v incoming="$2" -v kept="$3" -1 -f -' \
  sh "$db_name" "$incoming" "$kept" <<'SQL'
SELECT pg_terminate_backend(pid, 5000) FROM pg_stat_activity WHERE datname = :'live' AND pid <> pg_backend_pid();
ALTER DATABASE :"live" RENAME TO :"kept";
ALTER DATABASE :"incoming" RENAME TO :"live";
SQL

# 3. Bring an older backup up to the live release's schema (not when going back before a migration).
if [[ "$MIGRATE" != true ]]; then
  log "migrations skipped (--skip-migrations): the database stays exactly as in the backup"
elif [[ "$IMAGE_TAG" != none ]]; then
  log "applying the live release's migrations to the restored database"
  dc --profile tools run --rm -T migrate || warn "migrations failed on the restored database (see above); the API may not start"
fi

# 4. Uploaded files: unpack beside the current ones first; replace them only once that worked.
if [[ -n "$UPLOADS" ]]; then
  uploads_volume="$(env_require "$SHARED_DIR/.env" UPLOADS_VOLUME)"
  log "restoring uploaded files into volume $uploads_volume"
  docker run --rm -i --network none -v "$uploads_volume:/data" --entrypoint sh "$postgres_image" -c '
    set -e
    rm -rf /data/.restore-incoming
    mkdir /data/.restore-incoming
    tar -C /data/.restore-incoming -xzf -
    find /data -mindepth 1 -maxdepth 1 ! -name .restore-incoming -exec rm -rf {} \;
    find /data/.restore-incoming -mindepth 1 -maxdepth 1 -exec mv {} /data/ \;
    rmdir /data/.restore-incoming
    chown -R 1000:1000 /data' <"$ARCHIVE"
fi

log "restore finished; starting the API"
log "the previous data is kept as database $kept; once you are satisfied, drop it with:"
log "  scripts/dc.sh exec postgres dropdb -U $(env_require "$SHARED_DIR/postgres.env" POSTGRES_USER) $kept"
