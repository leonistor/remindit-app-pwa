#!/usr/bin/env sh
# Scheduled backup entrypoint for the systemd timer: snapshots the feedback
# module's Answer data (sqlite VACUUM INTO snapshot + uploads/config tar — see
# feedback/scripts/backup-answer.ts) then PocketBase's pb_data/ via the
# superuser API. Loads the repo-root .env via bun --env-file (dotenv semantics
# — no shell sourcing) and self-locates the repo root. The answer half is
# best-effort: its failure must not block the pb_data/ backup that follows.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# --env-file is explicit (D9): the scripts run with each module dir as cwd, so
# Bun's automatic .env discovery would miss the repo-root file.
if ! (
  cd "$REPO_ROOT/feedback" &&
    bun --env-file="$REPO_ROOT/.env" scripts/backup-answer.ts
); then
  echo "[backup] WARNING: answer backup failed — continuing with pb_data/" >&2
fi

cd "$REPO_ROOT/bff"
exec bun --env-file="$REPO_ROOT/.env" scripts/backup-pb.ts
