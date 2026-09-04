#!/usr/bin/env sh
# bm2-managed feedback (Apache Answer) launcher. Loads the repo-root .env via
# bun --env-file (dotenv semantics — no shell sourcing, so unquoted values with
# spaces are safe) and runs the feedback start script, which downloads the
# Answer binary + prepares the data dir on first boot and then serves.
# Self-locates the repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/feedback"
exec bun --env-file="$REPO_ROOT/.env" run start
