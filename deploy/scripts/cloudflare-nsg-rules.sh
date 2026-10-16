#!/usr/bin/env bash
# Prints OCI network security group (NSG) ingress rules that allow one TCP port only from Cloudflare,
# as JSON for the OCI CLI. Run on your own machine; it does not call OCI itself.
#
#   bash deploy/scripts/cloudflare-nsg-rules.sh 443 >cf-443.json
#   bash deploy/scripts/cloudflare-nsg-rules.sh 80  >cf-80.json
#   oci network nsg rules add --nsg-id <nsg-ocid> --security-rules file://cf-443.json
#   oci network nsg rules add --nsg-id <nsg-ocid> --security-rules file://cf-80.json
#
# The ranges come from deploy/nginx/snippets/cloudflare-realip.conf (refresh it with
# update-cloudflare-ips.sh first), so nginx and the network trust the same list. IPv4 only unless
# --ipv6 is given (add it only when the VCN and the VM have IPv6). See deploy/README.md →
# "Restricting the origin to Cloudflare" before removing the 0.0.0.0/0 rules.
set -Eeuo pipefail

# Works with the bash 3.2 that macOS ships.
port="${1:-}"
ipv6=false
if [[ "${2:-}" == --ipv6 ]]; then ipv6=true; fi
if ! [[ "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
  echo "usage: $0 <port> [--ipv6]" >&2
  exit 1
fi

snippet="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/snippets/cloudflare-realip.conf"
ranges="$(awk '/^set_real_ip_from / { gsub(";", "", $2); print $2 }' "$snippet")"
[[ -n "$ranges" ]] || { echo "no ranges found in $snippet" >&2; exit 1; }

first=true
printf '['
for cidr in $ranges; do
  if [[ "$cidr" == *:* && "$ipv6" != true ]]; then continue; fi
  [[ "$first" == true ]] || printf ','
  first=false
  printf '\n  {"direction":"INGRESS","protocol":"6","source":"%s","sourceType":"CIDR_BLOCK","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":%d,"max":%d}},"description":"Cloudflare tcp/%d"}' \
    "$cidr" "$port" "$port" "$port"
done
printf '\n]\n'
