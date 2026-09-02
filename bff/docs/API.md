# BFF API (phase 3)

Typed Hono RPC surface — frontends consume `hc<AppType>` from
`@remindit/bff/api` (type-only import). Every request/response below is a Zod
contract in `src/contracts.ts`; responses are parsed against those schemas in
`tests/api.integration.test.ts` (live, 10/10 against PB 0.40.1).

## Authentication

PB tokens are stateless JWTs; there is no server session store.

- **pwa (native-ish):** store `token` from register/login, send
  `Authorization: Bearer <token>` on every call.
- **web/admin (SSR):** register/login also set the `remindit_session`
  HttpOnly SameSite=Lax cookie (`Secure` in prod via `SESSION_COOKIE_SECURE`);
  requests may rely on the cookie instead of the header.

Every authenticated request re-validates **and rotates** the token through
PB's `auth-refresh` (middleware `src/middleware/auth.ts`); the refreshed token
is used server-side for the request and is available in the response context —
stateless sessions stay alive without expiry juggling. All downstream PB calls
run on the caller's token, so **PB API rules are the authorization boundary**
(D8) — the BFF never widens access.

### Endpoints

| Method & path | Auth | Body | Response | Notes |
|---|---|---|---|---|
| `POST /api/auth/register` | — | `{ email, password, passwordConfirm, username, firstName?, lastName? }` | `201 { token, user }` + cookie | Open signup (PB `users.createRule`); duplicate username/email → 400 with PB `details` |
| `POST /api/auth/login` | — | `{ email, password }` | `200 { token, user }` + cookie | wrong password → 400 |
| `POST /api/auth/logout` | — | — | `204` + cleared cookie | stateless: clients also discard the stored token |
| `GET /api/auth/me` | Bearer/cookie | — | `200 user` | garbage/expired token → 401 |

`user` shape (`userPublicSchema`): `{ id, email, username, firstName, lastName, avatar }` — `email` is empty for other users (PB `emailVisibility`).

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
| `POST /api/groups/:id/members` | `{ userId, role }` | `201 Member` | **owner only** (PB hydrated-record createRule); member invite → 400 |
| `DELETE /api/groups/:id/members/:memberId` | — | `204` | owner removes anyone, members remove themselves |

### Endpoints — notifications (stub, D4)

Channel undecided; only the read path exists (dispatch in phase 5+).

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `GET /api/notifications` | — | `200 Notification[]` | own only (`user = auth.id`) |
| `PATCH /api/notifications/:id` | `{ read }` | `200 Notification` | mark-read/unread |

### Endpoints — misc

| Method & path | Response | Notes |
|---|---|---|
| `GET /api/health` | `200 { ok, service, pb: { status } }` | PB-down is a reported state, not a 5xx |
| `GET /api/sse` | SSE stream | phase-1 spike / diagnostics |

## Error shape

```json
{ "error": "Failed to create record.", "details": { "username": { "code": "validation_duplicate_value" } } }
```

PB errors bubble out of services and are shaped once in `app.onError`
(`src/lib/pb-error.ts`); anything else → `500 { error: "internal server error" }`.

## Live rule matrix (phase 3 gate)

10/10 integration tests: register→me (Bearer), garbage token 401, wrong
password 400, duplicate username 400, group create + owner-membership
auto-provision, owner invite with expanded profile, member sees the group,
non-member invite 400 (PB create-rule), member cannot remove others (404),
self-leave 204, owner delete cascades, notification list/mark-read isolation.
