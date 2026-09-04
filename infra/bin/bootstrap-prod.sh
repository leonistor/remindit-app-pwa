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
ADMIN_PASS=$(openssl rand -hex 10)
HASH=$(caddy hash-password --plaintext "$ADMIN_PASS")
# Uncomment the basicauth block and inject the generated hash. Rerun-safe:
# both the commented (first run) and uncommented (later runs) lines match, so
# each run replaces the previous hash with the fresh one.
sed -E -i "s|^[[:space:]]*#?[[:space:]]*basicauth \{|\tbasicauth {|" /etc/caddy/remindit.caddyfile
sed -E -i "s|^[[:space:]]*#?[[:space:]]*admin .*|\tadmin $HASH|" /etc/caddy/remindit.caddyfile
grep -q "remindit.caddyfile" /etc/caddy/Caddyfile ||
  echo "import /etc/caddy/remindit.caddyfile" >>/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
echo "admin.remindit.me basicauth → admin / $ADMIN_PASS  (store it now)"

echo "=== 3/4 bm2: persist process list + reboot unit ==="
sudo -u leo /home/leo/.bun/bin/bm2 save
/home/leo/.bun/bin/bm2 startup install

echo "=== 4/4 exposure check (nothing new should be public) ==="
ss -tln | awk 'NR>1 {split($4,a,":"); port=a[length(a)]; if (port==8090 || port==9615 || port==9616) print "  WARNING: port " port " is listening publicly!"}' | grep . || echo "  ok: 8090/9615/9616 not publicly listening"
systemctl is-enabled remindit-backup.timer
echo "done"
