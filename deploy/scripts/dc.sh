#!/usr/bin/env bash
# `docker compose` for the live release, with the production configuration. Run as the deploy user:
#
#   /opt/dcarjt/current/scripts/dc.sh ps
#   /opt/dcarjt/current/scripts/dc.sh logs --tail=100 api
#   /opt/dcarjt/current/scripts/dc.sh exec postgres psql -U dcarjt dcarjt
#
# Never use `down -v` out of habit: the data volumes are external and survive it, but there is no
# reason to stop the database for routine work.
LOG_TAG=dc
# shellcheck source=deploy/scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
export IMAGE_TAG="${IMAGE_TAG:-$(current_tag)}"
[[ -n "$IMAGE_TAG" ]] || die "nothing deployed yet"
dc "$@"
