#!/usr/bin/env sh
# bm2-managed PocketBase launcher. Loads the repo-root .env via bun --env-file
# (dotenv semantics — no shell sourcing, so unquoted values with spaces are
# safe) and runs the Bun launcher. Self-locates the repo root so it works
# regardless of bm2's cwd.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/bff"
exec bun --env-file="$REPO_ROOT/.env" scripts/serve-pb.ts
