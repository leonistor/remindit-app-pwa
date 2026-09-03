# @remindit/feedback

Community feedback capture on [Apache Answer](https://answer.apache.org) — a
Q&A platform shipped as a single Go binary. The module owns the binary's
lifecycle locally: download → verify → configure → run → stop.

## Layout

```
feedback/
├── scripts/
│   ├── setup.ts      # download tar.gz + sha256 verify + extract + config
│   ├── start.ts      # ensure setup → run foreground (AUTO_INSTALL env)
│   └── stop.ts       # SIGTERM via answer.pid (pid-reuse guarded)
├── src/
│   ├── env.ts        # FEEDBACK_* vars from the root .env (D9)
│   └── lib/setup.ts  # pure helpers: asset mapping, checksums, config render
├── tests/            # bun:test over the pure helpers
└── answer-data/      # gitignored — sqlite db, uploads, conf/config.yaml
```

The binary (`answer`), its version stamp (`.answer-version`), the pid file
(`answer.pid`), and `answer-data/` are all gitignored — the module dir stays
clean in git.

## Workflow

```sh
bun run setup:feedback   # one-time (rerun-safe): binary + config + i18n + DB install
bun run dev:feedback     # start (foreground; reuses a running instance)
bun run stop:feedback    # stop
```

Direct-port `http://localhost:5555` always works; the Caddy workflow serves
`https://feedback.remindit.localhost` (block in the repo `Caddyfile` — reload
with `bun run caddy:reload` after first adding it).

### Setup (everything happens here)

`setup.ts` downloads + sha256-verifies + extracts the release tar.gz, writes
`conf/config.yaml` (once), extracts the i18n bundles, and — on a fresh data
dir — runs the headless install (`answer init` with `AUTO_INSTALL=true` and
the `FEEDBACK_*` env vars: sqlite, site name/URL, admin name/email/password).
No browser wizard. Two upstream quirks worth knowing: `answer i18n` extracts
to the CWD (so setup runs it from the target dir), and even in auto-install
mode `answer init` briefly binds `INSTALL_PORT` — setup pins it to
`FEEDBACK_PORT` (the default `:80` collides with the local Caddy).

### Version pinning

`FEEDBACK_VERSION` pins the release (default `2.0.2`); empty resolves the
latest GitHub release at setup time. Assets:
`apache-answer-{v}-bin-{os}-{arch}.tar.gz` + `checksums.txt` (sha256
verified before extraction).

## Troubleshooting

- **Port already in use** — `bun run stop:feedback`, or find the squatter on
  `FEEDBACK_PORT` (default 5555).
- **Stale pid / won't stop** — `stop.ts` verifies the pid still points at the
  Answer binary before signalling; a reused pid is left alone.
- **Config drift** — `conf/config.yaml` is written once; delete `answer-data/`
  to reset the whole install (fresh DB + admin on next boot).
- **502 from Caddy** — the binary isn't running; start it.
