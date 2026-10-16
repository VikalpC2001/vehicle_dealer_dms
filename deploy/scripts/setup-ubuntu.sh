#!/usr/bin/env bash
# First-time preparation of a fresh Oracle Cloud Ubuntu VM (22.04 or 24.04). Run ONCE as root:
#
#   sudo bash setup-ubuntu.sh --ci-public-key ci_deploy_key.pub [--deploy-user deploy] \
#        [--deploy-root /opt/dcarjt] [--swap 2G] [--skip-upgrade]
#
# Installs Docker Engine + the Compose plugin from Docker's official repository, configures log
# rotation, creates the deploy user (member of the docker group) with the CI public key, creates the
# directory layout, opens ports 80/443 in the VM's own firewall (Oracle images allow only SSH), turns
# on automatic security updates and installs the backup/health timers. Safe to run again.
#
# It does NOT change SSH settings, create users with passwords, or touch the OCI network rules
# (those are set in the OCI Console; see deploy/README.md).
set -Eeuo pipefail

DEPLOY_USER=deploy
DEPLOY_ROOT=/opt/dcarjt
CI_PUBLIC_KEY=""
SWAP_SIZE=""
UPGRADE=true
while (($#)); do
  case "$1" in
    --deploy-user) DEPLOY_USER="${2:?}"; shift ;;
    --deploy-root) DEPLOY_ROOT="${2:?}"; shift ;;
    --ci-public-key) CI_PUBLIC_KEY="${2:?}"; shift ;;
    --swap) SWAP_SIZE="${2:?}"; shift ;;
    --skip-upgrade) UPGRADE=false ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 1 ;;
  esac
  shift
done

log() { printf '[setup] %s\n' "$*"; }
die() { printf '[setup] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" == 0 ]] || die "run as root (sudo bash $0 …)"
# shellcheck source=/dev/null
[[ -r /etc/os-release ]] && . /etc/os-release
[[ "${ID:-}" == ubuntu ]] || die "this script supports Ubuntu only"
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "invalid user name: $DEPLOY_USER"
[[ "$DEPLOY_ROOT" == /* ]] || die "--deploy-root must be an absolute path"
[[ -z "$CI_PUBLIC_KEY" || -r "$CI_PUBLIC_KEY" ]] || die "cannot read $CI_PUBLIC_KEY"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DEBIAN_FRONTEND=noninteractive

# ── Packages ─────────────────────────────────────────────────────────────────────────────────────
log "updating packages"
apt-get update -y
if [[ "$UPGRADE" == true ]]; then
  apt-get -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade -y
fi
# tzdata: the backup timer's schedule names a time zone (systemd cannot parse it without zoneinfo).
apt-get install -y ca-certificates curl gnupg rsync jq util-linux unattended-upgrades tzdata

# ── Docker Engine (official repository) ──────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "installing Docker Engine and the Compose plugin"
  for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    apt-get remove -y "$pkg" >/dev/null 2>&1 || true
  done
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  log "Docker already installed: $(docker --version)"
fi

# Log rotation for every container (compose.yaml sets the same per service) + keep containers
# running while the Docker daemon restarts (e.g. package upgrades).
if [[ ! -f /etc/docker/daemon.json ]]; then
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
  log "wrote /etc/docker/daemon.json"
else
  log "kept existing /etc/docker/daemon.json"
fi
systemctl enable --now containerd docker
systemctl restart docker

# ── Deploy user ──────────────────────────────────────────────────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
  log "created user $DEPLOY_USER (no password: SSH key only)"
fi
# Membership of the docker group is equivalent to root on this host; only the deploy key gets it.
usermod -aG docker "$DEPLOY_USER"
deploy_home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$deploy_home/.ssh"
if [[ -n "$CI_PUBLIC_KEY" ]]; then
  touch "$deploy_home/.ssh/authorized_keys"
  if ! grep -qxF "$(cat "$CI_PUBLIC_KEY")" "$deploy_home/.ssh/authorized_keys"; then
    cat "$CI_PUBLIC_KEY" >>"$deploy_home/.ssh/authorized_keys"
    log "authorized the CI deploy key for $DEPLOY_USER"
  fi
  chown "$DEPLOY_USER:$DEPLOY_USER" "$deploy_home/.ssh/authorized_keys"
  chmod 600 "$deploy_home/.ssh/authorized_keys"
fi

# ── Directories ──────────────────────────────────────────────────────────────────────────────────
for dir in "$DEPLOY_ROOT" "$DEPLOY_ROOT/releases" "$DEPLOY_ROOT/shared" "$DEPLOY_ROOT/shared/state" \
  "$DEPLOY_ROOT/shared/nginx" "$DEPLOY_ROOT/shared/backups" "$DEPLOY_ROOT/shared/restore" "$DEPLOY_ROOT/shared/certs"; do
  install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$dir"
done
chmod 700 "$DEPLOY_ROOT/shared/backups" "$DEPLOY_ROOT/shared/restore"
# A copy of these scripts for the first configuration (later releases bring their own copy).
rsync -a --delete "$SOURCE_DIR/" "$DEPLOY_ROOT/bootstrap/"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT/bootstrap"
log "copied the deploy files to $DEPLOY_ROOT/bootstrap"

# ── Firewall: Oracle's Ubuntu images REJECT everything except SSH in iptables ────────────────────
# Open 80/443 now and in the saved rule file. The file is edited directly instead of running
# `netfilter-persistent save`, which would also save Docker's own (changing) rules.
if command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    if ! iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      iptables -I INPUT 1 -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT
      log "opened tcp/$port in iptables"
    fi
  done
  rules=/etc/iptables/rules.v4
  if [[ -f "$rules" ]]; then
    cp -p "$rules" "$rules.before-dcarjt"
    for port in 80 443; do
      line="-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT"
      if ! grep -qxF -- "$line" "$rules"; then
        # Before the first INPUT REJECT rule; without one, the port is not blocked anyway.
        awk -v l="$line" '!done && /^-A INPUT .*-j REJECT/ { print l; done = 1 } { print }' "$rules" >"$rules.new"
        cat "$rules.new" >"$rules"
        rm -f "$rules.new"
      fi
    done
    iptables-restore --test <"$rules" || { cp -p "$rules.before-dcarjt" "$rules"; die "edited $rules is invalid; restored the original"; }
    log "tcp/80 and tcp/443 open after reboots too ($rules)"
  fi
fi
# ufw rules do not apply to Docker-published ports and would only give a false sense of safety.
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  log "NOTE: ufw is active; it does not filter Docker-published ports — restrict ports in the OCI security list instead"
fi

# ── Swap (small VMs) ─────────────────────────────────────────────────────────────────────────────
if [[ -n "$SWAP_SIZE" ]] && ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  sysctl -q vm.swappiness=10
  echo 'vm.swappiness=10' >/etc/sysctl.d/99-swappiness.conf
  log "created ${SWAP_SIZE} swap"
fi

# ── Automatic security updates ───────────────────────────────────────────────────────────────────
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

# ── Backup and health timers ─────────────────────────────────────────────────────────────────────
for unit in "$SOURCE_DIR"/systemd/*.service "$SOURCE_DIR"/systemd/*.timer; do
  sed -e "s|@DEPLOY_USER@|$DEPLOY_USER|g" -e "s|@DEPLOY_ROOT@|$DEPLOY_ROOT|g" "$unit" >"/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable dcarjt-backup.timer dcarjt-health.timer >/dev/null
log "installed dcarjt-backup.timer and dcarjt-health.timer (they start working after the first deploy)"
systemctl start dcarjt-backup.timer dcarjt-health.timer

log "done. Next, as $DEPLOY_USER: bash $DEPLOY_ROOT/bootstrap/scripts/configure-server.sh --help"
