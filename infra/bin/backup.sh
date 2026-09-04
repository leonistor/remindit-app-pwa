#!/usr/bin/env sh
# Scheduled backup entrypoint for the systemd timer: snapshots the feedback
# module's Answer data (sqlite VACUUM INTO snapshot + uploads/config tar — see
# feedback/scripts/backup-answer.ts), then PocketBase's pb_data/ via the
# superuser API, then mirrors both local backup dirs off-box to Scaleway S3
# via rclone (D11). Loads the repo-root .env via bun --env-file (dotenv
# semantics — no shell sourcing; SCW_* values are parsed by grep, they never
# contain spaces) and self-locates the repo root.
#
# Tolerance ladder: the answer half is best-effort, the PB half is critical
# (its failure aborts the run), the off-box copy is best-effort again — local
# archives always remain the source of truth. rclone copy never deletes
# remotely; off-box retention is its own window (--min-age), so a local wipe
# cannot take the off-box copies down with it.
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
bun --env-file="$REPO_ROOT/.env" scripts/backup-pb.ts

# --- off-box mirror (Scaleway S3 via rclone, D11) ---
scw_var() {
  grep -E "^$1=" "$REPO_ROOT/.env" | cut -d= -f2-
}
SCW_ACCESS_KEY=$(scw_var SCW_ACCESS_KEY)
SCW_SECRET_KEY=$(scw_var SCW_SECRET_KEY)
SCW_REGION=$(scw_var SCW_REGION)
SCW_BUCKET=$(scw_var SCW_BUCKET)

if [ -z "$SCW_ACCESS_KEY" ] ||
  [ -z "$SCW_SECRET_KEY" ] ||
  [ -z "$SCW_REGION" ] ||
  [ -z "$SCW_BUCKET" ] ||
  ! command -v rclone >/dev/null 2>&1
then
  echo "[backup] off-box copy skipped (SCW_* not configured or rclone missing)" >&2
  exit 0
fi

# Env-based remote (no rclone.conf); RCLONE_CONFIG=/dev/null silences the
# "config file not found" notice without disabling env remotes.
RCLONE_ENV="RCLONE_CONFIG=/dev/null RCLONE_CONFIG_SCW_TYPE=s3
RCLONE_CONFIG_SCW_PROVIDER=Scaleway
RCLONE_CONFIG_SCW_ACCESS_KEY_ID=$SCW_ACCESS_KEY
RCLONE_CONFIG_SCW_SECRET_ACCESS_KEY=$SCW_SECRET_KEY
RCLONE_CONFIG_SCW_ENDPOINT=s3.$SCW_REGION.scw.cloud"

rclone_run() {
  # shellcheck disable=SC2086
  env $RCLONE_ENV "$@"
}

if [ -d "$REPO_ROOT/bff/pb_data/backups" ] &&
  [ -d "$REPO_ROOT/feedback/answer-data/backups" ] &&
  rclone_run rclone copy "$REPO_ROOT/bff/pb_data/backups" "SCW:$SCW_BUCKET/pb/" &&
  rclone_run rclone copy "$REPO_ROOT/feedback/answer-data/backups" \
    "SCW:$SCW_BUCKET/answer/"
then
  # Off-box retention window: independent of the local 10-archive keep —
  # hourly archives older than 30 days are removed remotely.
  rclone_run rclone delete --min-age 30d "SCW:$SCW_BUCKET/pb/" || true
  rclone_run rclone delete --min-age 30d "SCW:$SCW_BUCKET/answer/" || true
  echo "[backup] off-box copy done (s3.$SCW_REGION.scw.cloud/$SCW_BUCKET)"
else
  echo "[backup] WARNING: off-box copy failed — local archives are intact" >&2
fi
