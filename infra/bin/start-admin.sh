#!/usr/bin/env sh
# bm2-managed admin (TanStack Start SSR) launcher. Loads the repo-root .env via
# bun --env-file (dotenv semantics — no shell sourcing, so unquoted values with
# spaces are safe) and runs the rsbuild preview server (built artifacts must
# already exist — build separately on deploy). Self-locates the repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/admin"
exec bun --env-file="$REPO_ROOT/.env" run preview
