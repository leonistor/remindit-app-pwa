#!/usr/bin/env sh
# bm2-managed admin (TanStack Start SSR) launcher. Sources the repo-root .env and
# runs the rsbuild preview server (built artifacts must already exist — build
# separately on deploy). Self-locates the repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$REPO_ROOT/.env"
cd "$REPO_ROOT/admin"
exec bun run preview
