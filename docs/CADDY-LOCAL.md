# Local HTTPS dev via Caddy

HTTPS in dev with the same subdomain topology as production, powered by a
brew-services Caddy reverse proxy. Needed because HTTPS-only platform features
(service workers / PWA install, secure cookies, WebAuthn) can't be exercised
over plain `http://localhost`.

## Topology

| URL | Proxies to | Module |
| --- | --- | --- |
| `https://pwa.remindit.localhost` | `127.0.0.1:3000` | pwa dev server (Rsbuild) |
| `https://web.remindit.localhost` | `127.0.0.1:3200` | web dev server (Rsbuild) |
| `https://admin.remindit.localhost` | `127.0.0.1:3300` | admin dev server (Rsbuild) |
| `https://bff.remindit.localhost` | `127.0.0.1:3100` | BFF (Hono) |

- Domains use the RFC 6761 reserved `*.localhost` scheme — always resolves to
  127.0.0.1, no `/etc/hosts` edits, and can never collide with real DNS
  (unlike pointing the actual `*.parsedwink.com` names at loopback, which
  would silently hit production whenever Caddy is stopped).
- **PocketBase is not proxied** (D2: never a public surface) — its admin UI
  stays on `http://127.0.0.1:8090/_/`.
- Direct-port URLs (`http://localhost:3000` etc.) keep working; the BFF URL
  and CORS allowlist in `.env` cover both workflows simultaneously.

## Config split

```
/opt/homebrew/etc/Caddyfile     global options (local_certs) + `import` of the repo Caddyfile
<repo>/Caddyfile                the four site blocks (versioned)
```

The brew launchd agent
(`~/Library/LaunchAgents/homebrew.mxcl.caddy.plist`) runs
`caddy run --config /opt/homebrew/etc/Caddyfile`. Global option blocks are
only allowed in that main file, which is why project Caddyfiles hold site
blocks only and get `import`ed.

## One-time setup

1. Caddy + service:

   ```sh
   brew install caddy
   brew services start caddy
   ```

2. **Trust the local CA — with the service's storage env.** The launchd
   service overrides `HOME`/`XDG_DATA_HOME` to `/opt/homebrew/var/lib`, so
   its PKI (and CA root) live there. Run `caddy trust` with the same
   overrides, otherwise you'd install the root of a *different* storage than
   the background service actually uses:

   ```sh
   HOME=/opt/homebrew/var/lib XDG_DATA_HOME=/opt/homebrew/var/lib caddy trust
   ```

   (prompts for the admin password once; installs the root into the macOS
   Keychain — from then on browsers show a trusted padlock, no warnings)

3. `bun run caddy:reload` (or `brew services restart caddy`) after any
   Caddyfile change.

## Daily workflow

```sh
brew services start caddy   # once per login session (KeepAlive keeps it up)
bun run dev:all             # dev servers on their usual ports
# open https://pwa.remindit.localhost etc.
```

Caddy answers `502` for a host whose dev server isn't running — expected.

## How it fits together

- **Dev servers must allow the proxied Host header.** webpack-dev-server
  (Rsbuild) rejects unknown `Host` headers by default ("Invalid Host
  header"), so each rsbuild config allowlists the three
  `*.remindit.localhost` names via `server.allowedHosts`.
- **BFF over HTTPS.** Once pages are served over HTTPS, calls to
  `http://localhost:3100` are mixed content and blocked — hence
  `PUBLIC_BFF_URL=https://bff.remindit.localhost` in `.env`. This works for
  the direct-port workflow too (an `https` fetch from an `http` page is
  allowed), so one `.env` serves both. The `CORS_ORIGINS` allowlist likewise
  contains all six origins (3 Caddy + 3 localhost ports).
- **Cookies mirror production.** `SESSION_COOKIE_SECURE=true` works on
  `http://localhost` as well (browsers treat it as a trustworthy origin).
- **Certs.** The global `local_certs` option forces Caddy's internal CA for
  every site (no ACME/Let's Encrypt attempts); `*.localhost` would use it
  anyway.

## Troubleshooting

- **Port conflicts** (`bind: address already in use` in
  `/opt/homebrew/var/log/caddy.log`): `lsof -nP -iTCP:443 -sTCP:LISTEN` and
  stop the other listener (macOS allows user processes to bind <1024, so no
  sudo involved).
- **"Invalid Host header"** in the browser: the host isn't in
  `server.allowedHosts` in that module's rsbuild config.
- **Cert warnings after a Caddy/data reset**: the storage was regenerated —
  wipe the old root from Keychain ("Caddy Local Authority" certificates) and
  re-run the step-2 `caddy trust` command. Nuking the storage:
  `rm -rf /opt/homebrew/var/lib/caddy`.
- **`caddy trust` fails with `sudo: a password is required`** in a
  non-interactive shell: run it in a real terminal.
- **web/ SSR stats show `—` locally**: expected. The web module fetches
  `PUBLIC_BFF_URL` server-side with Bun fetch, which does **not** read the
  macOS Keychain, so it can't trust the Caddy root and degrades to `null`
  counts (by design, never a 500). If you need real numbers locally, export
  the root and point Bun at an appended CA bundle:

  ```sh
  cat /opt/homebrew/var/lib/caddy/pki/authorities/local/root.crt \
    >> /opt/homebrew/etc/caddy-dev-bundle.pem   # once
  # then in .env: SSL_CERT_FILE=/opt/homebrew/etc/caddy-dev-bundle.pem
  ```

  (browser clients are unaffected — they use the Keychain)

## References

- [Caddyfile docs](https://caddyserver.com/docs/caddyfile)
- sanjaymenon.xyz: [local HTTPS with Caddy](https://sanjaymenon.xyz/blog/local-https-development-caddy/)
- varunbarad.com: [HTTPS local sites](https://varunbarad.com/blog/https-local-sites)
