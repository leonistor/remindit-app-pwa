# AGENTS.md — @remindit/feedback

Module rules for the `feedback/` workspace (`@remindit/feedback`). Repo-wide
rules live in the root [AGENTS.md](../AGENTS.md). Runs Apache Answer (Q&A
platform, single Go binary) as a local sidecar on `:5555`, sub-host
`feedback.remindit.localhost`.

## Rules

- **Binary, not a service dependency**: the Answer binary is downloaded by
  `scripts/setup.ts` into the module root (gitignored) and version-stamped in
  `.answer-version` — never commit it, never vendor it.
- **Data dir is install state**: `answer-data/` (gitignored) holds the sqlite
  DB, uploads, and `conf/config.yaml`. Setup writes the config once; it never
  rewrites an existing one (Answer treats its presence as "installed").
- **Auto-install is env-driven**: first boot passes `AUTO_INSTALL=true` +
  `FEEDBACK_*` vars from the root `.env` (D9) — no manual browser wizard.
- **Port is `FEEDBACK_PORT`** (default 5555) — rendered into
  `conf/config.yaml` at setup and pinned via `SITE_ADDR` at start.
- Platform support matrix: linux/mac × amd64/arm64 (same as
  `@fadlee/pocketbase-bin` — see `src/lib/setup.ts`).
- Tests use `bun:test`, unit-level only (pure helpers in `src/lib/setup.ts`).

## Commands

- `bun run setup` — download/verify/extract the binary, prepare data dir +
  config (idempotent)
- `bun run start` — ensure setup, then run Answer in the foreground with
  auto-install env; reuses an already-running instance (health probe)
- `bun run stop` — SIGTERM the pid recorded in `answer.pid` (pid-reuse guarded)
- `bun run test` / `typecheck` / `lint` / `check` — standard toolchain

Run from the repo root: `bun run setup:feedback`, `bun run dev:feedback`,
`bun run stop:feedback`.

## Docs

- [README.md](README.md) — devdoc (layout, install flow, troubleshooting)
- [../docs/FEEDBACK.md](../docs/FEEDBACK.md) — original reference notes
  (folders, config, tags)
