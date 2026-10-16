#!/usr/bin/env bash
# Regenerates deploy/nginx/snippets/cloudflare-realip.conf from Cloudflare's published ranges.
# Run on a development machine, review the diff, commit and deploy:
#
#   bash deploy/scripts/update-cloudflare-ips.sh && git diff deploy/nginx/snippets/cloudflare-realip.conf
set -Eeuo pipefail
out="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/snippets/cloudflare-realip.conf"
v4="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)"
v6="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)"
cidr='^[0-9a-fA-F:.]+/[0-9]{1,3}$'
for range in $v4 $v6; do [[ "$range" =~ $cidr ]] || { echo "unexpected entry: $range" >&2; exit 1; }; done
[[ $(wc -w <<<"$v4") -ge 5 && $(wc -w <<<"$v6") -ge 3 ]] || { echo "the lists look incomplete" >&2; exit 1; }
{
  echo "# Cloudflare edge ranges (https://www.cloudflare.com/ips/), retrieved $(date -u +%Y-%m-%d)."
  echo "# Only requests that really come from these ranges may set the visitor address via CF-Connecting-IP."
  echo "# Refresh with: deploy/scripts/update-cloudflare-ips.sh (then commit and deploy)."
  for range in $v4 $v6; do echo "set_real_ip_from $range;"; done
  echo "real_ip_header CF-Connecting-IP;"
} >"$out"
echo "updated $out"
