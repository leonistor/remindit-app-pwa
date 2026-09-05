# BFF API (phase 3)

Typed Hono RPC surface — frontends consume `hc<AppType>` from
`@remindit/bff/api` (type-only import). Every request/response below is a Zod
contract in `src/contracts.ts`; responses are parsed against those schemas in
`tests/api.integration.test.ts` (live, 13/13 against PB 0.40.1).

> PB collections are `teams`/`team_members` (renamed); the HTTP surface and contract keys below keep the groups naming for stability.

## Authentication

PB tokens are stateless JWTs; there is no server session store.

- **pwa / admin:** store `token` from register/login, send
  `Authorization: Bearer <token>` on every call.
- **web (SSR):** register/login also set the `remindit_session`
  HttpOnly SameSite=Lax cookie (`Secure` in prod via `SESSION_COOKIE_SECURE`);
  server-side requests rely on the cookie instead of the header (cookie
  transport is reserved for web SSR auth — browser clients use Bearer).

### Session lifecycle (near-expiry rotation)

Every authenticated request decodes the token's JWT claims locally
(`src/middleware/auth.ts`) — no signature check:

- **Fresh token** (more than ~20% of its lifetime remaining): the middleware
  makes **no PocketBase call**. Validity still fails closed — PB re-checks
  the token on every upstream call (services and the `/pb` forwarder stamp
  the same token), so an invalid token is rejected at the first data call.
- **Near expiry**: the middleware calls PB `auth-refresh` (this validates the
  signature) and uses the rotated token server-side. The fresh token is
  delivered back so stateless sessions survive past the original 14-day TTL:
  - `X-Session-Token: <fresh>` response header on every response where
    rotation happened (exposed via CORS);
  - the `remindit_session` cookie is re-issued when the request
    authenticated via cookie.

**Clients SHOULD persist the `X-Session-Token` value in place of their stored
token** — that is what keeps Bearer sessions alive. A token is rejected with
401 only when PB refuses to refresh it; if PocketBase is unreachable the BFF
answers `503 { error: "PocketBase is temporarily unavailable, please retry" }`
— a retryable infra failure, not a credential failure. All downstream PB
calls run on the caller's token, so **PB API rules are the authorization
boundary** (D8) — the BFF never widens access.

### Endpoints

| Method & path | Auth | Body | Response | Notes |
|---|---|---|---|---|
| `POST /api/auth/register` | — | `{ email, password, passwordConfirm, username, firstName?, lastName? }` | `201 { token, user }` + cookie | Open signup (PB `users.createRule`); duplicate username/email → 400 with PB `details` |
| `POST /api/auth/login` | — | `{ email, password }` | `200 { token, user }` + cookie | wrong password → 400 |
| `POST /api/auth/logout` | — | — | `204` + cleared cookie | stateless: clients also discard the stored token |
| `GET /api/auth/me` | Bearer/cookie | — | `200 user` | garbage/expired token → 401 |

`user` shape (`userPublicSchema`): `{ id, email, username, firstName, lastName, avatar, role? }` — `email` is empty for other users (PB `emailVisibility`); `role` (`user`\|`admin`) rides the auth endpoints for client-side gating.

### Endpoints — groups (shared workspaces, D1)

All require auth. Authorization = PB rules (owner ∨ member, see
[SCHEMA.md](SCHEMA.md)); PB rule denials surface as 400/403/404 through the
BFF's error mapper with `{ error, details? }`.

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `GET /api/groups` | — | `200 Group[]` | groups the caller owns or belongs to |
| `POST /api/groups` | `{ name }` | `201 Group` | creator becomes `owner` member (membership auto-provisioned) |
| `GET /api/groups/:id` | — | `200 Group` | member/owner only |
| `DELETE /api/groups/:id` | — | `204` | owner only; PB cascades group data |
| `GET /api/groups/:id/members` | — | `200 Member[]` | `{ id, role, group, user }` with expanded profile |
| `POST /api/groups/:id/members` | `{ userId, role }` | `201 Member` | **owner only** (PB hydrated-record createRule); member invite → 400; dispatches `member.added` to the invitee (D4) |
| `DELETE /api/groups/:id/members/:memberId` | — | `204` | owner removes anyone, members remove themselves; dispatches `member.removed` (→ removed user) or `member.left` (→ owner, on self-leave) — membership/team/actor are read *before* the delete, since a departed member loses team read access |

### Endpoints — users

| Method & path | Auth | Query | Response | Notes |
|---|---|---|---|---|
| `GET /api/users/lookup` | Bearer/cookie | `username` (exact, `usernameSchema`-validated) | `200 UserPublic` (email `""`) / `404 { error: "user not found" }` | profile visibility per the `users` listRule (any authenticated user); resolves invitees for the pwa share flow |

### Endpoints — notifications (D4 — in-app realtime)

Channel decided 2026-09-03 (Web Push deferred, email rejected — ROADMAP D4).
The rows are **written by the groups service** (best-effort, superuser-side —
the createRule is self-only) on membership lifecycle events; these endpoints
are the read/mark path only. Types are plain text; payload is untyped json:
`{ teamId, teamName, actorUsername }`.

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `GET /api/notifications` | — | `200 Notification[]` | own only (`user = auth.id`), newest-first (`-created` server-side) |
| `PATCH /api/notifications/:id` | `{ read }` | `200 Notification` | mark-read/unread |

### Endpoints — admin (phase 6)

All require an authenticated session with `users.role = "admin"`; the role
check is server-side (`requireAdmin`, 403 before any superuser query).

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `GET /api/admin/overview` | — | `200 { users, groups, items, listEntries, historyEvents }` | global counters (from the `platform_stats` view; contract key keeps the groups naming) |
| `GET /api/admin/users` | — | `200 { items, total }` | paginated user table (`page`/`perPage`/`filter` query params) |
| `POST /api/admin/users` | `{ email, password, passwordConfirm, username, ... }` | `201 { user }` | create-user (the admin registration flow) |
| `DELETE /api/admin/users/:id` | — | `204` | delete user (cascades memberships) |
| `GET /api/admin/groups` | — | `200 { items, total }` | paginated group/team table (`team_details` view) |
| `DELETE /api/admin/groups/:id` | — | `204` | cascade-delete a team |

### Endpoints — misc

| Method & path | Response | Notes |
|---|---|---|
| `GET /api/health` | `200 { ok, service, pb: { status } }` | PB-down is a reported state, not a 5xx |
| `GET /api/stats` | `200 { users, groups }` | public aggregate counts for the marketing site (superuser-side, 60s-cached, `cache-control: public, max-age=60`) |
| `GET /api/sse` | SSE stream | phase-1 spike / diagnostics |
| `ANY /pb/api/*` | PB passthrough | **Data-plane forwarder (phase 5)**: authenticated proxy to the internal PocketBase for the pwa sync engine (PB SDK `baseUrl = PUBLIC_BFF_URL + "/pb"`). Requires a BFF session, forwards the rotated token, streams SSE unbuffered; rules stay the authorization boundary. See [../docs/SYNC.md](../../pwa/docs/SYNC.md) |

## Error shape

```json
{ "error": "Failed to create record.", "details": { "username": { "code": "validation_duplicate_value" } } }
```

PB errors bubble out of services and are shaped once in `app.onError`
(`src/lib/pb-error.ts`); anything else → `500 { error: "internal server error" }`.

Invalid request bodies fail with the same envelope —
`400 { "error": "validation failed", "details": { "formErrors": [...], "fieldErrors": { "email": ["..."] } } }`
— via the shared zValidator hook (`src/lib/validation.ts`), never Hono's
default `{ success: false, error: [...] }` shape.

## Live rule matrix (phase 3 gate)

13/13 integration tests (skip when PB is down): register→me (Bearer), garbage
token 401, wrong password 400, duplicate username 400, group create +
owner-membership auto-provision, owner invite with expanded profile, member
sees the group, non-member invite 400 (PB create-rule), member cannot remove
others (404), self-leave 204, owner delete cascades, notification
list/mark-read isolation, stats contract.
