#!/usr/bin/env bash
# Runs deploy.sh DETACHED from this terminal or SSH session, streams its log, and exits with its status.
# The deploy workflow uses it: a dropped connection or a cancelled workflow only stops the streaming;
# the deploy itself finishes on the server (and rolls back on its own when it fails).
#
#   $DEPLOY_ROOT/releases/<tag>/scripts/run-deploy.sh <tag> [deploy.sh options]
#
# Logs: $DEPLOY_ROOT/shared/state/deploys/<UTC time>-<tag>.log (+ .status with the exit code).
LOG_TAG=run-deploy
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

tag="${1:-}"
[[ "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || die "usage: run-deploy.sh <tag> [deploy.sh options]"
require_cmd setsid tail

mkdir -p "$STATE_DIR/deploys"
log_file="$STATE_DIR/deploys/$(date -u +%Y%m%dT%H%M%SZ)-${tag:0:12}.log"
status_file="$log_file.status"
: >"$log_file"

# A new session without a terminal; output only to the log file (never to this session's pipes).
# -w: when setsid has to fork, it waits for the deploy, so $! stays alive exactly as long as the deploy.
DEPLOY_LOG="$log_file" DEPLOY_STATUS="$status_file" setsid -w bash -c \
  '"$@" >"$DEPLOY_LOG" 2>&1 </dev/null; echo "$?" >"$DEPLOY_STATUS"' run-deploy "$SCRIPT_DIR/deploy.sh" "$@" \
  </dev/null >/dev/null 2>&1 &
pid=$!
log "deploy of $tag started (pid $pid); log: $log_file"

# Stream the log until the deploy ends (tail exits when the process does).
tail -n +1 -f --pid="$pid" "$log_file" || true
for _ in $(seq 1 10); do [[ -s "$status_file" ]] && break; sleep 1; done
status="$(cat "$status_file" 2>/dev/null || echo 1)"
[[ "$status" =~ ^[0-9]+$ ]] || status=1
log "deploy of $tag finished with exit code $status"
exit "$status"
