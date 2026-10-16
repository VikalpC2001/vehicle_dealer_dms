#!/usr/bin/env bash
# Creates the production configuration on the server and checks it is ready for the first deploy.
# Run as the deploy user after setup-ubuntu.sh:
#
#   bash /opt/dcarjt/bootstrap/scripts/configure-server.sh \
#     --registry bom.ocir.io --image-namespace <tenancy-namespace>/dcarjt \
#     [--domain dcarjt.com] [--www-domain www.dcarjt.com] [--api-domain api.dcarjt.com]
#
# Writes $DEPLOY_ROOT/shared/.env, api.env and postgres.env from the *.example templates, with a
# generated database password and JWT secret. An existing file is NEVER overwritten (secrets are
# generated once). Afterwards: fill in the remaining CHANGE_ME values in api.env (Gemini, SMTP),
# install the origin certificate (see deploy/README.md) and run this script again to re-check.
LOG_TAG=configure
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DOMAIN_ARG=""
WWW_ARG=""
API_ARG=""
REGISTRY_ARG=""
NAMESPACE_ARG=""
while (($#)); do
  case "$1" in
    --domain) DOMAIN_ARG="${2:?}"; shift ;;
    --www-domain) WWW_ARG="${2:?}"; shift ;;
    --api-domain) API_ARG="${2:?}"; shift ;;
    --registry) REGISTRY_ARG="${2:?}"; shift ;;
    --image-namespace) NAMESPACE_ARG="${2:?}"; shift ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option $1" ;;
  esac
  shift
done
# Without --domain, later runs check against the domains already saved in .env.
if [[ -z "$DOMAIN_ARG" && -f "$SHARED_DIR/.env" ]]; then
  DOMAIN_ARG="$(env_get "$SHARED_DIR/.env" DOMAIN || true)"
  WWW_ARG="${WWW_ARG:-$(env_get "$SHARED_DIR/.env" WWW_DOMAIN || true)}"
  API_ARG="${API_ARG:-$(env_get "$SHARED_DIR/.env" API_DOMAIN || true)}"
fi
DOMAIN_ARG="${DOMAIN_ARG:-dcarjt.com}"
WWW_ARG="${WWW_ARG:-www.$DOMAIN_ARG}"
API_ARG="${API_ARG:-api.$DOMAIN_ARG}"
domain_re='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'
for d in "$DOMAIN_ARG" "$WWW_ARG" "$API_ARG"; do [[ "$d" =~ $domain_re ]] || die "invalid domain: $d"; done

require_cmd docker openssl
[[ -w "$SHARED_DIR" ]] || die "$SHARED_DIR is not writable by $(id -un) (run setup-ubuntu.sh first)"
mkdir -p "$STATE_DIR" "$SHARED_DIR/certs" "$SHARED_DIR/nginx"
umask 077

# Replaces KEY=… in FILE (first occurrence) without interpreting the value.
set_value() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" 'BEGIN { done = 0 } $0 ~ "^" k "=" && !done { print k "=" v; done = 1; next } { print }' "$file" >"$tmp"
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

# ── .env (stack settings, not secret) ────────────────────────────────────────────────────────────
if [[ -f "$SHARED_DIR/.env" ]]; then
  log "kept existing $SHARED_DIR/.env"
else
  [[ -n "$REGISTRY_ARG" && -n "$NAMESPACE_ARG" ]] || die "first run needs --registry and --image-namespace"
  cp "$RELEASE_DIR/.env.example" "$SHARED_DIR/.env"
  set_value "$SHARED_DIR/.env" DOMAIN "$DOMAIN_ARG"
  set_value "$SHARED_DIR/.env" WWW_DOMAIN "$WWW_ARG"
  set_value "$SHARED_DIR/.env" API_DOMAIN "$API_ARG"
  set_value "$SHARED_DIR/.env" REGISTRY "$REGISTRY_ARG"
  set_value "$SHARED_DIR/.env" IMAGE_NAMESPACE "$NAMESPACE_ARG"
  set_value "$SHARED_DIR/.env" DEPLOY_GID "$(id -g)"
  chmod 640 "$SHARED_DIR/.env"
  log "wrote $SHARED_DIR/.env"
fi

# ── postgres.env + api.env (secrets, generated once) ─────────────────────────────────────────────
if [[ -f "$SHARED_DIR/postgres.env" ]]; then
  log "kept existing $SHARED_DIR/postgres.env"
  db_password="$(env_require "$SHARED_DIR/postgres.env" POSTGRES_PASSWORD)"
else
  # Hex only: safe inside a connection URL without escaping.
  db_password="$(openssl rand -hex 24)"
  cp "$RELEASE_DIR/postgres.env.example" "$SHARED_DIR/postgres.env"
  set_value "$SHARED_DIR/postgres.env" POSTGRES_PASSWORD "$db_password"
  chmod 600 "$SHARED_DIR/postgres.env"
  log "wrote $SHARED_DIR/postgres.env (generated database password)"
fi

if [[ -f "$SHARED_DIR/api.env" ]]; then
  log "kept existing $SHARED_DIR/api.env"
else
  db_user="$(env_require "$SHARED_DIR/postgres.env" POSTGRES_USER)"
  db_name="$(env_require "$SHARED_DIR/postgres.env" POSTGRES_DB)"
  cp "$RELEASE_DIR/api.env.example" "$SHARED_DIR/api.env"
  set_value "$SHARED_DIR/api.env" DATABASE_URL "postgresql://$db_user:$db_password@postgres:5432/$db_name?schema=public&connection_limit=10&pool_timeout=20"
  set_value "$SHARED_DIR/api.env" JWT_SECRET "$(openssl rand -hex 32)"
  set_value "$SHARED_DIR/api.env" ALLOWED_ORIGINS "https://$DOMAIN_ARG"
  set_value "$SHARED_DIR/api.env" FRONTEND_URL "https://$DOMAIN_ARG"
  set_value "$SHARED_DIR/api.env" WEBAUTHN_RP_ID "$DOMAIN_ARG"
  set_value "$SHARED_DIR/api.env" WEBAUTHN_RP_ORIGIN "https://$DOMAIN_ARG"
  set_value "$SHARED_DIR/api.env" BASE_URL "https://$API_ARG"
  chmod 600 "$SHARED_DIR/api.env"
  log "wrote $SHARED_DIR/api.env (generated JWT secret and database URL)"
fi

# ── Certificate ──────────────────────────────────────────────────────────────────────────────────
cert="$SHARED_DIR/certs/$(basename "$(env_get "$SHARED_DIR/.env" TLS_CERTIFICATE || echo origin.crt)")"
key="$SHARED_DIR/certs/$(basename "$(env_get "$SHARED_DIR/.env" TLS_CERTIFICATE_KEY || echo origin.key)")"
if [[ -f "$cert" && -f "$key" ]]; then
  # nginx reads the key through the deploy user's group (DEPLOY_GID in .env); nobody else may.
  if [[ -O "$key" && -O "$cert" ]]; then
    chgrp "$(id -g)" "$key" "$cert"
    chmod 640 "$key"
    chmod 644 "$cert"
  else
    warn "the certificate files are not owned by $(id -un); run: sudo chown $(id -un):$(id -gn) $cert $key"
  fi
  if openssl x509 -in "$cert" -noout >/dev/null 2>&1; then
    log "certificate: $(openssl x509 -in "$cert" -noout -subject -enddate | tr '\n' ' ')"
    cert_pub="$(openssl x509 -in "$cert" -noout -pubkey | openssl sha256 || true)"
    key_pub="$(openssl pkey -in "$key" -pubout 2>/dev/null | openssl sha256 || true)"
    [[ -n "$cert_pub" && "$cert_pub" == "$key_pub" ]] ||
      warn "$key is not the private key of this certificate (or is not a readable, unencrypted PEM key)"
    for d in "$DOMAIN_ARG" "$WWW_ARG" "$API_ARG"; do
      openssl x509 -in "$cert" -noout -checkhost "$d" 2>/dev/null | grep -q 'does match' ||
        warn "the certificate does not cover $d"
    done
  else
    warn "$cert is not a PEM certificate"
  fi
else
  warn "install the origin certificate as $cert and its key as $key (see deploy/README.md → TLS)"
fi

# ── Volumes ──────────────────────────────────────────────────────────────────────────────────────
ensure_volumes

# ── Final check ──────────────────────────────────────────────────────────────────────────────────
if (validate_config) 2>&1; then
  log "configuration complete; the server is ready for the first deploy"
else
  log "fix the items above and run this script again"
  exit 1
fi
