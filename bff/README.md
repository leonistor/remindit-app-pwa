# @remindit/bff

Backend-for-frontend: **PocketBase** (data, auth, realtime — internal only) +
**Hono** on **Bun.serve** (the single public API surface). Platform rollout:
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md); decision log:
[docs/DECISIONS.md](../docs/DECISIONS.md); module rules:
[AGENTS.md](AGENTS.md).

## Architecture

```
pwa / web / admin
      │  Hono RPC (hc<AppType>) + PB SDK baseUrl=BFF (hybrid data-plane, D2)
      ▼
Hono (Bun.serve, PORT)                    ── public surface
  ├─ /api/*    typed endpoints (routes → services → repositories, D8)
  └─ /pb/*     scoped PB data-plane forwarder (pwa sync; SSE-capable)
      ▼
PocketBase (POCKETBASE_URL, 127.0.0.1:8090) ── never public
  └─ pb_data/ (SQLite volume, gitignored)
```

- `src/app.ts` — Hono app assembly; exports `app` + `AppType`. Frontends:
  `import type { AppType } from "@remindit/bff/api"` (type-only).
- `src/contracts.ts` — Zod schemas = published response shapes; services
  return data satisfying them.
- `src/repositories/pocketbase.ts` — the **only** module instantiating the PB
  SDK client (server-side; `autoCancellation(false)`; other files only
  `import type PocketBase`).
- `src/routes/sse.ts` — phase-1 spike: SSE streams unbuffered through Hono on
  Bun (verified by `tests/sse.test.ts`); transport basis for phase-5 realtime.

## Endpoints

Full request/response contracts and the live-verified
rule matrix: [docs/API.md](docs/API.md).

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register` / `login` / `logout`, `GET /api/auth/me` | PB auth pass-through (Bearer **and** HttpOnly session cookie; tokens rotate via auth-refresh) |
| `GET/POST /api/groups`, `GET/DELETE /api/groups/:id` | shared workspaces (creator = owner member; underlying PB collections: `teams`/`team_members`) |
| `GET/POST /api/groups/:id/members`, `DELETE …/:memberId` | membership management (owner-only mutations via PB rules); lifecycle notification rows dispatched on membership changes (D4) |
| `GET /api/users/lookup?username=` | exact-match username → minimal public profile (email masked) — resolves invitees for the pwa share flow |
| `GET /api/notifications`, `PATCH /api/notifications/:id` | in-app notifications (D4): list + mark-read; rows are written by the groups service's dispatch (best-effort, superuser-side) |
| `GET /api/admin/*` | role-guarded (`users.role = "admin"`, 403 otherwise): overview counts, user/group management, create-user, delete-group |
| `ANY /pb/api/*` | authenticated PB data-plane forwarder (pwa sync — SSE-capable) |
| `GET /api/stats` | public aggregate counts (superuser-side, 60s-cached) for the marketing site |
| `GET /api/health` | shared health report (200 always; `checks.pb: "up"\|"down"` — a down PB is a reported check, not a 5xx) |
| `GET /api/sse` | SSE spike/diagnostic — emits 3 `ping` events 150ms apart |
| `POST /api/ai/chat` | AI support chat (phase 1): streams a VoltAgent support-assistant reply (grounded on `bff/content/support-en.md`) as a UIMessageStreamResponse for the pwa's Assistant UI |

## Dev flow

```sh
bun run dev:bff    # from repo root: root .env injected (D9)
bun run dev:all    # pwa + bff concurrently
```

`scripts/dev.ts` starts PocketBase via `bunx @fadlee/pocketbase-bin serve`
(pin recorded in `bff/.pocketbase-version`; binary + `.pocketbase-version`
cached in `bff/`, `pb_data/` via `POCKETBASE_DATA_DIR`), polls `/api/health`
until reachable (120s deadline — the first run downloads the binary), reuses
an already-running PB, then starts Hono on `PORT`. Ctrl+C tears down both.

The PB superuser is provisioned in phase 2 (migrations); until then PB runs
with no accounts and only anon routes are reachable — `/api/health` still
reports `pb: "up"` because `/api/health` on PB is public.

## Schema & migrations (phase 2)

The served PocketBase schema is code: `src/schema/collections.ts` (desired
state, built on `@remindit/common`) + `scripts/migrate.ts` (idempotent
reconcile: structure pass, then rules/indexes patch — never deletes). Full
mapping, rules rationale and the live-verified rule matrix:
[docs/SCHEMA.md](docs/SCHEMA.md).

```sh
bun run dev:bff      # PocketBase must be running
bun run migrate:bff  # from repo root — run twice; second run must be a no-op
```

## Platform seed (curated demo data)

One curated dataset (`@remindit/common/seeds`, source `common/seeds/
platform.json`) powers realistic admin/web/pwa demos: 15 users (2 admins,
solo shoppers, two families, ad-hoc groups like "Trip to Italy"), 7 teams
with per-team catalog, current list, simulated 180-day history and
`member.added` notifications. The `bff` seeder writes it superuser-side,
**idempotently** (second run creates nothing).

```sh
bun run seed:bff  # PocketBase must be running; refuses NODE_ENV=production
```

- Dataset/typed loader live in `common` (shared + testable); write logic in
  `bff/src/seeds/seed.ts`; thin env-facing CLI in `bff/scripts/seed.ts`.
- Idempotency keys: users by unique `username`; teams by `owner + name`;
  content by unique `(team, localId)` where category/item local ids reuse the
  pwa scheme (`hashId("cat::…")` / `hashId("item::…")`) — a fresh pwa joining
  a seeded group reconciles with **identical ids**.
- **Every seed user shares the same dev/demo password — `SEED_PASSWORD` from
  the root `.env`** (`bun run seed:bff` reads it; `.env.example` shows a
  placeholder). The committed dataset carries no password so it stays
  credential-free for scanners. Admin app: `admin@example.com` / that password.
  Login as any username to demo sync, group switching, invite-by-username and
  notifications.
- Runs against the dev/local DB. Prod refuses to seed (env guard). A pristine
  demo = fresh `pb_data` (delete `bff/pb_data`, `dev:bff` re-downloads/migrates,
  then `seed:bff`).

## Environment (D9)

All from the root `.env` (see root `.env.example`): `PORT`,
`POCKETBASE_URL`, `POCKETBASE_DATA_DIR`,
`POCKETBASE_ADMIN_EMAIL`/`POCKETBASE_ADMIN_PASSWORD` (dev-only),
`SEED_PASSWORD`, `SESSION_COOKIE_SECURE`, `CORS_ORIGINS`,
`AUTH_RATE_LIMIT`. Never create `bff/.env`.

AI env (phase 1 — see `bff/src/services/ai.ts` + the `model:eval` script):
`AI_PROVIDER` (`ollama` dev default | `openrouter`), `AI_MODEL` (optional
override), `OLLAMA_BASE_URL` (`http://pop-os.lan:11434`),
`OLLAMA_MODEL` (`qwen2.5:7b`, chosen 2026-09-07),
`OPENROUTER_REMINDIT_KEY` (no default), `OPENROUTER_MODEL`
(`minimax/minimax-m3:free`, chosen 2026-09-07).

## Testing

`bun test` (from `bff/` or root `bun run test:bff`):

- `tests/health.test.ts` — contract round-trip via `app.request()` + Zod parse
- `tests/rpc.test.ts` — live server + `hc<AppType>` client (the frontend path)
- `tests/sse.test.ts` — incremental-chunk assertion (buffering detector)
- `tests/schema.test.ts` — collection-builder integrity (names, ordering, common mirroring)
- `tests/auth.test.ts` — auth boundaries (no-credentials paths)
- `tests/api.integration.test.ts` — live auth/groups flows, responses parsed against the Zod contracts (skips when PB is down)
- `tests/pb-forwarder.integration.test.ts` — forwarder auth gating, rule-scoped CRUD, unique-index dedupe, SSE passthrough
- `tests/admin.integration.test.ts` — admin role guards + user/group management (live)

## AI smoke test

`bun run ai-smoke` (repo root) asks a fixed set of hypothetical support
questions to each configured model and prints the answers side by side, so the
local Ollama model can be compared against OpenRouter on the real grounding
content (`content/support-en.md`). Set `AI_PROVIDER=ollama|openrouter` to run
a single provider (default: both, skipping whichever isn't configured).
Requires the root `.env` (D9); no BFF server needed.

## Model evaluation (`bun run model:eval`)

For the model-selection pass — compares a **list** of candidate support-assistant
models (any number, local + remote) on the full question battery, with timing:

```bash
bun run model:eval                                        # default sets
bun run model:eval --ollama "gemma3:4b,qwen3:8b"          # override local list
bun run model:eval --openrouter "minimax/minimax-m3:free" # override remote list
bun run model:eval --only openrouter                      # one provider
# or via env: OLLAMA_EVAL_MODELS=... OPENROUTER_EVAL_MODELS=... EVAL_ONLY=...
```

Defaults (selected 2026-09-07): ollama `qwen2.5:7b,llama3.1:8b,
granite3.3:8b`; openrouter `minimax/minimax-m3:free,
nvidia/nemotron-3-ultra-550b-a55b:free, dots-studio/dots-3-note-preview:free`.
(`inkling:free` and the older `nemotron-3-super:free` were dropped — agentic-only
/ Invalid-JSON through this harness.) Implementation: `bff/scripts/model-eval.ts`.

## pocketbase-mcp (agent ops)

`opencode.jsonc` declares a `pocketbase` MCP server wrapping
`bff/scripts/pocketbase-mcp.ts`, which injects `PB_URL`/superuser creds from
the root `.env` into `gaspechak-pocketbase-mcp` (requires a running PB —
`bun run dev:bff`). Enable it in `opencode.jsonc` while working on this
module.
