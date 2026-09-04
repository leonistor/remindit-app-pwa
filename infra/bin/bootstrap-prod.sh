#!/bin/sh
# Phase D one-time privileged bootstrap — run ONCE on the VPS as root:
#   ssh -t leo@server.parsedw.ink 'sudo sh /srv/remindit/infra/bin/bootstrap-prod.sh'
# Unprivileged prep (repo, .env, bun install, builds, bm2 start) must already
# be done (docs/DEPLOY-VPS.md). Idempotent: safe to rerun.
set -e
REPO=/srv/remindit

echo "=== 1/4 backup timer (pb_data + answer-data, hourly) ==="
# Copy under the systemd unit names — cp preserves basenames, and the timer
# pairs with its service by filename (remindit-backup.*).
cp "$REPO/infra/backup.service" /etc/systemd/system/remindit-backup.service
cp "$REPO/infra/backup.timer" /etc/systemd/system/remindit-backup.timer
# Stale mis-named copies from an earlier bootstrap run.
rm -f /etc/systemd/system/backup.service /etc/systemd/system/backup.timer
systemctl daemon-reload
systemctl enable --now remindit-backup.timer

echo "=== 2/4 Caddy: site blocks + admin basicauth ==="
cp "$REPO/infra/Caddyfile" /etc/caddy/remindit.caddyfile
# The repo Caddyfile ships a basic_auth placeholder (D2) — swap in a generated
# hash on first run; on reruns the existing hash is kept and the password is
# NOT regenerated (it would be printed without the old one staying valid).
if grep -q REPLACE_WITH_HASHED_PASSWORD /etc/caddy/remindit.caddyfile; then
  ADMIN_PASS=$(openssl rand -hex 10)
  HASH=$(caddy hash-password --plaintext "$ADMIN_PASS")
  sed -i "s|REPLACE_WITH_HASHED_PASSWORD|$HASH|" /etc/caddy/remindit.caddyfile
  echo "admin.remindit.me basicauth → admin / $ADMIN_PASS  (store it now)"
else
  echo "admin basicauth already configured — password unchanged"
fi
grep -q "remindit.caddyfile" /etc/caddy/Caddyfile ||
  echo "import /etc/caddy/remindit.caddyfile" >>/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
echo "admin.remindit.me basicauth → admin / $ADMIN_PASS  (store it now)"

echo "=== 3/4 bm2: persist process list + reboot unit ==="
# sudo/strip ~/.bun/bin from PATH — bm2's shebang (`env bun`) needs it, and
# `save` must run as leo to reach the daemon leo started.
BM2_ENV="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/leo/.bun/bin"
sudo -u leo env HOME=/home/leo "$BM2_ENV" /home/leo/.bun/bin/bm2 save
env HOME=/home/leo "$BM2_ENV" /home/leo/.bun/bin/bm2 startup install

echo "=== 4/4 exposure check (nothing new should be public) ==="
ss -tln | awk 'NR>1 {split($4,a,":"); port=a[length(a)]; if (port==8090 || port==9615 || port==9616) print "  WARNING: port " port " is listening publicly!"}' | grep . || echo "  ok: 8090/9615/9616 not publicly listening"
systemctl is-enabled remindit-backup.timer
echo "done"
