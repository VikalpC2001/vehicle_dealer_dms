#!/usr/bin/env bash
# One-off setup of a NEW production database, after the first successful deploy. Run as the deploy user:
#
#   /opt/dcarjt/current/scripts/bootstrap.sh
#
# Seeds the state/city lookup tables, creates the platform super-admin (asks for e-mail, name, mobile
# and password; nothing is passed on the command line) and adds the default document categories.
# Safe to run again: existing data is kept and an existing admin's password is not changed.
#
# Optional (environment): BOOTSTRAP_ADMIN_RESET_PASSWORD=true replaces an existing super-admin's
# password; BOOTSTRAP_ADMIN_PROMOTE_EXISTING=true promotes an existing ordinary account with that
# e-mail (only if it is really yours — anyone can register an account on the public site).
LOG_TAG=bootstrap
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

export IMAGE_TAG="${IMAGE_TAG:-$(current_tag)}"
[[ -n "$IMAGE_TAG" ]] || die "deploy first (no release is live yet)"

if [[ -z "${BOOTSTRAP_ADMIN_EMAIL:-}" ]]; then read -r -p "Super-admin e-mail: " BOOTSTRAP_ADMIN_EMAIL; fi
if [[ -z "${BOOTSTRAP_ADMIN_NAME:-}" ]]; then read -r -p "Super-admin name: " BOOTSTRAP_ADMIN_NAME; fi
if [[ -z "${BOOTSTRAP_ADMIN_MOBILE:-}" ]]; then read -r -p "Super-admin mobile number: " BOOTSTRAP_ADMIN_MOBILE; fi
if [[ -z "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
  read -r -s -p "Super-admin password (12+ characters): " BOOTSTRAP_ADMIN_PASSWORD; echo
  read -r -s -p "Repeat the password: " confirm; echo
  [[ "$BOOTSTRAP_ADMIN_PASSWORD" == "$confirm" ]] || die "the passwords do not match"
fi
export BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_MOBILE BOOTSTRAP_ADMIN_PASSWORD

log "seeding states and cities"
dc --profile tools run --rm -T migrate node_modules/.bin/tsx prisma/seed-geography.ts

log "creating the super-admin and default document categories"
# -e NAME (no value) passes the variable from this environment, so it never shows in a process list.
export BOOTSTRAP_ADMIN_RESET_PASSWORD="${BOOTSTRAP_ADMIN_RESET_PASSWORD:-false}"
export BOOTSTRAP_ADMIN_PROMOTE_EXISTING="${BOOTSTRAP_ADMIN_PROMOTE_EXISTING:-false}"
dc --profile tools run --rm -T \
  -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_MOBILE -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_RESET_PASSWORD -e BOOTSTRAP_ADMIN_PROMOTE_EXISTING \
  migrate node_modules/.bin/tsx prisma/bootstrap-production.ts

log "done: sign in at https://$(env_get "$SHARED_DIR/.env" DOMAIN) as $BOOTSTRAP_ADMIN_EMAIL"
