#!/usr/bin/env sh
# bm2-managed feedback (Apache Answer) launcher. Sources the repo-root .env and
# runs the feedback start script, which downloads the Answer binary + prepares
# the data dir on first boot and then serves. Self-locates the repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$REPO_ROOT/.env"
cd "$REPO_ROOT/feedback"
exec bun run start
