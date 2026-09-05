# TODO — active work

The working backlog. Product versions and the decision log live in
[docs/ROADMAP.md](docs/ROADMAP.md); the VPS runbook in
[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md). Completed planning material (phases H
hardening, P polish, F product, D deployment, FB feedback, the v5 audit docs)
was disposed 2026-09-04 after shipping — the detail lives in git history
(`TODO.md` before this rewrite, `docs/V5-IMPLEMENTATION.md`,
`docs/v5-review.md`) and in ROADMAP §7's phase notes.

## In flight

- **de/fr/uk translation drafts** — kick-started 2026-09-05 with
  `bun run kickstart:locale` in `common/` (local Ollama, translategemma:12b,
  tuned prompt; see `pwa/docs/DEV.md` §Internationalization). The shared-catalog
  migration's `web*` keys were filled in the same pass. ~40 keys across the
  three files kept English after safety-net rejections (invented/renamed
  `{tokens}`, mostly sentence-fragment keys) and the fresh `web*` keys may have
  leftovers too — listed in the run output and need human review before the
  locales ship. Shipping caveat: locales in
  `common/project.inlang/settings.json` get compiled by paraglide and
  **auto-served** to matching browsers via the `preferredLanguage` strategy on
  the next release — decide ship order / `APP_LOCALES` gating if the drafts
  aren't reviewed by then. The language selector (`APP_LOCALES`) is still
  en+ro; **web stays baseLocale** (English-only) until the drafts are reviewed.

## Next (V6 + wishlist, roadmap §1)

- [ ] Basic AI features
- [ ] LLM/MCP integration
- [ ] Item attributes (photo / quantity / price)
- [ ] Native app

## Deferred (by decision — revisit when triggered)

- **Notifications hardening** — when Web Push or digests arrive: typed `type`
  enum + discriminated payload in contracts, `dedupeKey` + `(user, created)`
  indexes via the idempotent migrate, paginated list (today: plain-text types,
  untyped payload, unpaginated `getFullList`).
- **Feedback follow-ups** — real SMTP provider (Inbucket is dev-grade; swap
  via `configure:feedback smtp`), logo upload in the Answer admin (API cap),
  delete the deployment smoke-test question.
- **Old host** — optional 301 `remindit.parsedwink.com` → `remindit.me`.
- **`pbtsdb` re-evaluation** — if TanStack DB ships GA offline persistence.

## Evaluated & rejected (2026-09-03)

- **`nathanstitt/pbtsdb`** (TanStack DB adapter for PocketBase; MIT, active,
  v0.7.2, 26★) — the only credible one. Not adopted: it's a remote-as-source-
  of-truth model (TanStack Query cache + optimistic overlay + realtime),
  while the pwa is local-first (device data is the source of truth offline;
  journal + three-way LWW + tombstones per `pwa/docs/SYNC.md`). Adopting it
  means replacing the nanostores layer + tested sync engine with a
  React/TanStack stack (4 new peer deps) for functional parity at best.
  **Re-evaluate** if TanStack DB ships GA offline persistence.
- **`Daniels-not/usemoor`** (offline-first optimistic hooks) — skip: v0.2.2,
  1★, single author, entire history in one commit burst (2026-07-30);
  whole-list resync per change (their own stated limit) vs the pwa's targeted
  reconcile; conflict resolution is local-wins only — a downgrade from the
  existing journal/LWW engine.
- **`KevinBonnoron/pocketbase-react-hooks`** — skip: dormant since 2025-12,
  and its `useAuth` wraps `pb.authStore` directly, bypassing the BFF auth
  contract (rotating tokens, cookie transport, D2/D8 layering). Duplicates
  what `pwa` stores + `bff` already do.
