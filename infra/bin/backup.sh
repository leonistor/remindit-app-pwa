#!/usr/bin/env sh
# Scheduled pb_data/ backup entrypoint for the systemd timer. Sources the
# repo-root .env (so superuser credentials resolve) and runs the Bun backup
# script. Self-locates the repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$REPO_ROOT/.env"
cd "$REPO_ROOT/bff"
exec bun scripts/backup-pb.ts
