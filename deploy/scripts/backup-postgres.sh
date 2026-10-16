#!/usr/bin/env bash
# Backs up the database (pg_dump custom format) and the uploaded files, then prunes old backups.
# Run as the deploy user; the systemd timer (systemd/dcarjt-backup.timer) runs it daily.
#
#   $DEPLOY_ROOT/current/scripts/backup-postgres.sh [--label NAME] [--db-only] [--skip-offsite]
#
# Files: $SHARED_DIR/backups/postgres/<db>-<UTC time>[-label].dump[.gpg]
#        $SHARED_DIR/backups/uploads/uploads-<UTC time>[-label].tar.gz[.gpg]
# Each file gets a .sha256 next to it. With BACKUP_PASSPHRASE_FILE set they are encrypted (gpg AES-256).
# Backups on this server do not survive losing the server: set BACKUP_OFFSITE_COMMAND (see .env).
LOG_TAG=backup
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

LABEL=""
DB_ONLY=false
OFFSITE=true
while (($#)); do
  case "$1" in
    --label) LABEL="${2:-}"; shift ;;
    --db-only) DB_ONLY=true ;;
    --skip-offsite) OFFSITE=false ;;
    -h | --help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option $1" ;;
  esac
  shift
done
[[ -z "$LABEL" || "$LABEL" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || die "label may only use letters, digits, '.', '_' and '-'"

require_cmd docker sha256sum
# compose.yaml interpolates IMAGE_TAG even for services we do not touch; use the live one.
export IMAGE_TAG="${IMAGE_TAG:-$(current_tag)}"
[[ -n "$IMAGE_TAG" ]] || IMAGE_TAG="none"

BACKUP_ROOT="$SHARED_DIR/backups"
mkdir -p "$BACKUP_ROOT/postgres" "$BACKUP_ROOT/uploads" "$STATE_DIR"
chmod 700 "$BACKUP_ROOT"
umask 077

stamp="$(date -u +%Y%m%dT%H%M%SZ)${LABEL:+-$LABEL}"
passphrase_file="$(env_get "$SHARED_DIR/.env" BACKUP_PASSPHRASE_FILE || true)"
if [[ -n "$passphrase_file" ]]; then
  require_cmd gpg
  [[ -r "$passphrase_file" ]] || die "BACKUP_PASSPHRASE_FILE $passphrase_file is not readable"
fi

# Encrypts $1 (adds .gpg) when a passphrase file is configured and writes its checksum; prints the
# final path. The unencrypted file is removed only after encryption succeeded.
seal() {
  local file="$1"
  if [[ -n "$passphrase_file" ]]; then
    if ! gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$passphrase_file" \
      --symmetric --cipher-algo AES256 --output "$file.gpg" "$file"; then
      rm -f "$file.gpg"
      return 1
    fi
    rm -f "$file"
    file="$file.gpg"
  fi
  (cd "$(dirname "$file")" && sha256sum "$(basename "$file")" >"$(basename "$file").sha256") || return 1
  printf '%s' "$file"
}

# Half-written files never stay behind (they would only fill the disk).
partials=()
trap 'rm -f "${partials[@]}"' EXIT

[[ -n "$(dc ps --status running -q postgres 2>/dev/null)" ]] || die "the postgres container is not running"

# ── Database ─────────────────────────────────────────────────────────────────────────────────────
db_name="$(env_require "$SHARED_DIR/postgres.env" POSTGRES_DB)"
dump="$BACKUP_ROOT/postgres/$db_name-$stamp.dump"
log "dumping database $db_name"
partials+=("$dump.partial")
# Credentials stay inside the container (its own environment).
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --compress=6' >"$dump.partial"
# A dump that pg_restore cannot list is not a backup.
dc exec -T postgres pg_restore --list <"$dump.partial" >/dev/null || die "the new dump is unreadable"
mv "$dump.partial" "$dump"
dump="$(seal "$dump")" || die "could not encrypt or checksum the dump (the unencrypted dump is kept)"
log "database backup: $dump ($(du -h "$dump" | cut -f1))"

# ── Uploaded files ───────────────────────────────────────────────────────────────────────────────
if [[ "$DB_ONLY" != true ]]; then
  uploads_volume="$(env_require "$SHARED_DIR/.env" UPLOADS_VOLUME)"
  archive="$BACKUP_ROOT/uploads/uploads-$stamp.tar.gz"
  partials+=("$archive.partial")
  log "archiving uploaded files (volume $uploads_volume)"
  # GNU tar from the live API image: files the running app moves or deletes meanwhile are warnings
  # (exit 1), not failures. Before the first deploy, the postgres image's tar does the job.
  tar_image="$(env_require "$SHARED_DIR/.env" REGISTRY)/$(env_require "$SHARED_DIR/.env" IMAGE_NAMESPACE)/api:$IMAGE_TAG"
  tar_args=(--ignore-failed-read --warning=no-file-changed --warning=no-file-removed)
  if ! docker image inspect "$tar_image" >/dev/null 2>&1; then
    tar_image="$(service_image postgres)" || die "could not determine the postgres image from compose.yaml"
    tar_args=()
  fi
  tar_status=0
  docker run --rm --network none -v "$uploads_volume:/data:ro" --entrypoint tar "$tar_image" \
    "${tar_args[@]}" -C /data -czf - . >"$archive.partial" || tar_status=$?
  ((tar_status <= 1)) || die "archiving the uploaded files failed (tar exit $tar_status)"
  ((tar_status == 0)) || warn "some files changed while they were archived (normal while the app is in use)"
  mv "$archive.partial" "$archive"
  archive="$(seal "$archive")" || die "could not encrypt or checksum the uploads archive (the unencrypted archive is kept)"
  log "uploads backup: $archive ($(du -h "$archive" | cut -f1))"
fi

# ── Retention ────────────────────────────────────────────────────────────────────────────────────
days="$(env_get "$SHARED_DIR/.env" BACKUP_RETENTION_DAYS || echo 14)"
[[ "$days" =~ ^[0-9]+$ ]] && ((days >= 1)) || days=14
find "$BACKUP_ROOT/postgres" "$BACKUP_ROOT/uploads" -type f -mtime "+$days" \
  \( -name '*.dump*' -o -name '*.tar.gz*' -o -name '*.sha256' \) -print -delete |
  sed 's/^/pruned: /' || true
# Upload archives are full copies of a mostly-growing set of files: keep only the newest few on this
# server (off-site copies keep the history), or they alone can fill the disk.
keep_archives="$(env_get "$SHARED_DIR/.env" UPLOADS_BACKUPS_TO_KEEP || echo 3)"
[[ "$keep_archives" =~ ^[0-9]+$ ]] && ((keep_archives >= 1)) || keep_archives=3
find "$BACKUP_ROOT/uploads" -maxdepth 1 -type f \( -name 'uploads-*.tar.gz' -o -name 'uploads-*.tar.gz.gpg' \) \
  -printf '%T@ %p\n' | sort -rn | awk -v keep="$keep_archives" 'NR > keep {print $2}' |
  while read -r old; do
    rm -f "$old" "$old.sha256"
    echo "pruned: $old"
  done

printf '{"time":"%s","database":"%s","uploads":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$dump" "${archive:-}" >"$STATE_DIR/last_backup.json"

# ── Off-site copy ────────────────────────────────────────────────────────────────────────────────
offsite="$(env_get "$SHARED_DIR/.env" BACKUP_OFFSITE_COMMAND || true)"
if [[ "$OFFSITE" == true && -n "$offsite" ]]; then
  log "copying backups off this server"
  if ! bash -c "${offsite//\{dir\}/$BACKUP_ROOT}"; then
    notify "Backup was taken but the off-site copy FAILED"
    die "off-site copy failed (local backup is fine: $dump)"
  fi
fi
log "backup finished"
