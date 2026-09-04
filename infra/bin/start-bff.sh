#!/usr/bin/env sh
# bm2-managed BFF (Hono) launcher. Sources the repo-root .env and runs the bff
# start script. Self-locates the repo root so it works regardless of bm2's cwd.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$REPO_ROOT/.env"
cd "$REPO_ROOT/bff"
exec bun run start
