#!/usr/bin/env bash
# Puts the API, frontend and nginx configuration back on an earlier release. Run as the deploy user:
#
#   $DEPLOY_ROOT/current/scripts/rollback.sh [<tag>] [--yes]
#
# Without <tag>, goes back to the release before the live one. The DATABASE IS NOT TOUCHED: migrations
# applied by later releases stay applied, so this is safe only when the older code works with the
# newer schema (additive migrations). When it does not, restore a backup instead — see
# restore-postgres.sh and "Rollback" in deploy/README.md.
LOG_TAG=rollback
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TARGET=""
ASSUME_YES=false
while (($#)); do
  case "$1" in
    --yes | -y) ASSUME_YES=true ;;
    -h | --help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown option $1" ;;
    *) TARGET="$1" ;;
  esac
  shift
done

require_cmd docker curl flock rsync
mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy or rollback is running"

LIVE="$(current_tag)"
[[ -n "$TARGET" ]] || TARGET="$(previous_tag)"
[[ -n "$TARGET" ]] || die "no previous release recorded; give a tag (see $STATE_DIR/releases.log)"
[[ "$TARGET" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || die "invalid image tag: $TARGET"
[[ "$TARGET" != "$LIVE" ]] || die "$TARGET is already live"

TARGET_RELEASE="$DEPLOY_ROOT/releases/$TARGET"
recreate_release=false
if [[ ! -f "$TARGET_RELEASE/compose.yaml" ]]; then
  warn "release directory $TARGET_RELEASE is gone; it will be recreated from the live release's compose and nginx files"
  recreate_release=true
fi

log "live: ${LIVE:-none} → rolling back to: $TARGET"
warn "database migrations applied after $TARGET stay applied"
if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type the tag to confirm (${TARGET:0:12}…): " answer
  [[ -n "$answer" && "$TARGET" == "$answer"* ]] || die "not confirmed"
fi
if [[ "$recreate_release" == true ]]; then
  rm -rf "$TARGET_RELEASE"
  cp -a "$RELEASE_DIR" "$TARGET_RELEASE"
fi

export IMAGE_TAG="$TARGET"
RELEASE_DIR="$TARGET_RELEASE"

validate_config
dc config --quiet || die "compose configuration of $TARGET is invalid"
# Kept releases still have their images here; pull only what is missing (the registry may be slow or down).
mapfile -t missing < <(services_missing_images "$TARGET" api frontend)
if ((${#missing[@]})); then
  log "pulling ${missing[*]} for $TARGET"
  DC_TIMEOUT=600 dc pull --quiet "${missing[@]}" ||
    die "could not pull ${missing[*]} for $TARGET (registry login? docker login $(env_get "$SHARED_DIR/.env" REGISTRY)); nothing was changed"
fi
render_nginx "$TARGET_RELEASE"
dc up -d --wait --wait-timeout 240 api frontend
activate_nginx
reload_or_start_nginx
"$SCRIPT_DIR/health-check.sh" --deploy || die "health check failed after rolling back; investigate with: scripts/dc.sh logs --tail=200 api"

[[ -n "$LIVE" ]] && printf '%s\n' "$LIVE" >"$STATE_DIR/previous_release"
printf '%s\n' "$TARGET" >"$STATE_DIR/current_release"
printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TARGET" "rolled-back-to" >>"$STATE_DIR/releases.log"
ln -sfn "$TARGET_RELEASE" "$DEPLOY_ROOT/current.tmp" && mv -T "$DEPLOY_ROOT/current.tmp" "$DEPLOY_ROOT/current"
log "rolled back to $TARGET"
notify "Rolled back $(env_get "$SHARED_DIR/.env" DOMAIN) to ${TARGET:0:12}"
