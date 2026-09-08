# Plan — "Basic AI features" (phase 2+ remaining)

Status: **planned, not started**. Pick up in a fresh session.

Roadmap source: `docs/ROADMAP.md` §Version 6 — the two open lanes under
"Basic AI features" are **persistent multi-thread memory** and **app
"commands"** (show list, recommendations, `add "mustard"`). The separate
`LLM/MCP (skills)` line is out of scope for this plan. Decisions below were
made with the user on 2026-09-08 and must land as a `D15` row in
`docs/DECISIONS.md` when the work ships.

## Decisions (locked)

1. **Tool execution = client-executed** (not server-side). The agent streams
   tool-call parts; the pwa executes them against the local nanostores via the
   existing commands (`createItemAndAddToList` → journal → LWW → sync). No
   BFF/schema write path, offline-safe, reuses the tested sync engine.
2. **Command surface first slice = read-only + `add`**: `list` (show list),
   `recommend` (what should I buy), `add` (single write). Defer remove/clear.
3. **Memory = persist the single thread** (per-user), not a multi-thread
   chat-history UI.

## Task A — persistent single-thread memory

Today the memory is in-memory `userId: "anonymous"` (`bff/src/routes/ai.ts`)
and only the last message is sent (`bff/src/services/ai.ts` single-shot).

1. Add a `conversations` collection in `bff/src/schema/collections.ts` —
   owned server-side; fields: `user` (optional relation, anon allowed),
   `threadId`/`conversationId`, persisted message/memory blob. Written only by
   the BFF. Runs through the idempotent migrate (`bun run migrate`).
2. Add `optionalAuth` (exists: `bff/src/middleware/auth.ts:134`) to
   `POST /api/ai/chat` so `userId` is the token claim, not `"anonymous"`.
3. Wire VoltAgent persistent memory — `AgentOptions` supports `memory` and
   `conversationPersistence` (see `@voltagent/core` types). Key by
   `userId/conversationId`. Replace the anonymous in-memory key; grounding
   instructions unchanged.
4. Client: Assistant UI thread already carries a stable `id` — no UI change
   (persist the single thread).

## Task B — app commands (tool-calling + write path)

Tools run **client-side**; read-only tools need **server access** to the
user's data, so we add a context endpoint.

1. **BFF context route** — authed `GET /api/ai/context` (`requireAuth`)
   returns the user's current list + catalog categories + recommendations
   (reuse `computeRecommendations`). New request/response types in
   `bff/src/contracts.ts`.
2. **BFF agent tools** — attach `tools` (Vercel AI SDK `Tool` shapes) to the
   support agent. `list`/`recommend` are server-executable and read from the
   authed context; `add` is marked **client-side / no-server-execute**
   (VoltAgent's `BaseToolManager` distinguishes these) so the BFF streams a
   tool-call part the pwa fulfils locally.
3. **pwa tool execution** — the assistant view (`pwa/src/views/assistant.tsx`)
   intercepts streamed `tool-call` parts (Assistant UI runtime) and executes:
   - read: `$list`, `$catalog`, `$categories`
   - write: `createItemAndAddToList(name, categoryId)`
     (`pwa/src/stores/commands.ts:52`)
4. **Client types** — mirror context/tool types in `pwa/src/lib/bff-api.ts`.
5. **i18n** — new user-facing labels in `common/messages/{en,ro}.json`
   (never generated `src/paraglide`).

## Out of scope (record as still-open)

- Full write set (remove/clear).
- LLM/MCP integration (`ROADMAP.md:69` — "put my list in a calendar").
- Multi-thread chat-history UI.

## Verification

- `bun run typecheck` (root), `bun run lint`, `bun run test:quick` (unit layer).
- Manual smoke: `bun run dev:all` → `/assistant`, verify `add "mustard"`
  lands on the list and syncs.

## Implementation split (parallelize)

- Sub-agent 1: Task A (schema + route auth + memory backend).
- Sub-agent 2: Task B BFF (context route + tool defs + contracts).
- Sub-agent 3: Task B pwa (tool-call interception + bff-api types + i18n).

## Doc changes at ship time

- `TODO.md` — trim "persistent multi-thread memory" + "commands" from open
  lanes; note shipped status under V6.
- `docs/ROADMAP.md` §Version 6 — mark the remaining bullets done.
- `docs/DECISIONS.md` — new `D15` row (client-executed tools + read-only/add
  slice + single-thread persistence).
