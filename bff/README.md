# @remindit/bff

Backend-for-frontend: **PocketBase** (data, auth, realtime — internal only) +
**Hono** on **Bun.serve** (the single public API surface). Phase plan and
decision log: [docs/ROADMAP.md](../docs/ROADMAP.md); module rules:
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
- `src/repositories/pocketbase.ts` — the **only** module importing the PB SDK
  (server-side; `autoCancellation(false)`).
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
| `GET /api/health` | BFF liveness + PocketBase reachability (`pb.status: "up" \| "down"`; PB down is a reported state, not a 5xx) |
| `GET /api/sse` | SSE spike/diagnostic — emits 3 `ping` events 150ms apart |

## Dev flow

```sh
bun run dev:bff    # from repo root: root .env injected (D9)
bun run dev:all    # pwa + bff concurrently
```

`scripts/dev.ts` starts PocketBase via `bunx @fadlee/pocketbase-bin serve`
(pinned by `POCKETBASE_VERSION`; binary + `.pocketbase-version` cached in
`bff/`, `pb_data/` via `POCKETBASE_DATA_DIR`), polls `/api/health` until
reachable (120s deadline — the first run downloads the binary), reuses an
already-running PB, then starts Hono on `PORT`. Ctrl+C tears down both.

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

## Feedback bridge (one-way, Apache Answer)

Registration provisions a matching user in the Answer sidecar (`feedback/`):
`services/feedback.ts` → `repositories/answer.ts` (admin-API client) creates
the Answer user with a throwaway password and stores the linkage in the
hidden `users.feedback_username` field. Non-fatal by design — if Answer is
down, registration proceeds and the backfill covers the gap:

```sh
bun run dev:feedback     # Answer must be running
bun run backfill:feedback  # from repo root — idempotent; links unlinked users
```

One-way only: no sync back into app state; no login story for bridged users
yet (TODO.md FB5). Credentials: `ANSWER_INTERNAL_URL`, `ANSWER_ADMIN_NAME`,
`ANSWER_ADMIN_EMAIL`, `ANSWER_ADMIN_PASSWORD` (root `.env`, D9).

## Environment (D9)

All from the root `.env` (see root `.env.example`): `PORT`,
`POCKETBASE_URL`, `POCKETBASE_VERSION`, `POCKETBASE_DATA_DIR`,
`POCKETBASE_ADMIN_EMAIL`/`POCKETBASE_ADMIN_PASSWORD` (dev-only),
`ANSWER_INTERNAL_URL`/`ANSWER_ADMIN_*` (feedback bridge). Never create
`bff/.env`.

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

## pocketbase-mcp (agent ops)

`opencode.jsonc` declares a `pocketbase` MCP server wrapping
`bff/scripts/pocketbase-mcp.ts`, which injects `PB_URL`/superuser creds from
the root `.env` into `gaspechak-pocketbase-mcp` (requires a running PB —
`bun run dev:bff`). Enable it in `opencode.jsonc` while working on this
module.
