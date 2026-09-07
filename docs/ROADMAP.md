# Remindit roadmap

Product roadmap — what the app does for its users, from the original
`pwa`-only outline, updated to the workspace perspective. Platform rollout
history, architecture and the decision log live in
[ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md); active
work and sequencing live in [TODO.md](../TODO.md) — update this file when
something ships, and TODO.md for what's in flight.

Product status: V1–V4 shipped (pwa v4.4.0), V5 shipped (v5.0.0, 2026-09-03),
V6 in progress, wishlist open. `D#` references point into
[DECISIONS.md](DECISIONS.md).

---

## Version 1 — shipped

- [x] The user has `items` to be added to the shopping `list`. The items are organized into `categories`. Adding/removing items from the list is logged into `history`.
- [x] The user data is: `name`, `photo`. If no data is available, the user is prompted to provide it or accept default values, randomly generated.
- [x] The main screen shows the list of items, organized by category. Controls are available to add/remove items, and to edit items and categories.

## Version 2 — shipped

- [x] Based on the user's shopping history, the app provides item recommendations.
- [x] The algorithm used for recommendations is either a time-series or a collaborative filtering algorithm. TBD.
- [x] Users will be able to add, edit, and remove items and categories.
- [x] Display ordering options will be available for categories, items, and the shopping list.

## Version 3 — shipped as v3.1.0–v3.4.0

Core PWA + personalization slice (see `pwa/CHANGELOG.md`):

- [x] Categorical color palettes (pool in `seed/palettes.json`, picker in Profile, Van Gogh default) — distinct sequential slots, WCAG contrast, reactive `$categoryById`
- [x] Basic user profile + first-run onboarding (2-step: rollable `generate-random-username` + DiceBear avatar, dataset picker, `/onboarding` gate, `src/stores/onboarding.ts`)
- [x] Inspect history (`/history`, grouped by day, snapshot `categoryName`)
- [x] Quick search+add (`+` → grouped `Autocomplete`, recommendation-aware, create-under-Uncategorized)
- [x] Automate screenshots in PWA manifest (`scripts/generate-mobile-screenshot.ts`, light/dark gallery in `pwa/README.md`)
- [x] PWA checklist & hardening — installability (manifest + SW `fetch` + HTTPS + maskable icons), offline shell, `navigateFallback`, safe-area, standalone mode, update prompt (`src/components/update-prompt.tsx`), `pwa/docs/DEPLOY.md`
- [x] App updates in browser (SW update flow, `UpdatePrompt` wired in `src/router.tsx`)
- [x] Help content — text (`pwa/src/views/help.tsx`, `about.tsx`, `onboarding.tsx` copy; updated for floating sort + alphabetical A–Z in v3.4)
- [x] Internal hardening pre-V4 — hooks out of `src/stores` barrel, cross-store flows in `src/stores/commands.ts`, pure helpers in `src/lib/` (`quick-add`, `history-view`, `display`, `pwa-install`), palette seeding consolidation, history snapshot + palette reactivity fixes

## Version 4 — shipped as v4.0.0–v4.4.0

- [x] [DESIGN.md](../pwa/DESIGN.md) — design system as shipped (contributors, text-only)
- [x] Onboarding welcome step — intro + add-items demo video (autoplay, muted, looped, no controls) with a `Steps` indicator rail (new `@shark/steps` primitive)
- [x] Share page (`/share`): export the current shopping list as a PNG image — light-theme branded card, unchecked items grouped by category, download + copy-to-clipboard (`@zumer/snapdom`)
- [x] Help content: guided tour (Help page embeds 5 demo videos with theme-matched variants)
- [x] Add license (AGPL-3 LICENSE.txt at repo root)
- [x] Multi-language support — English (default) + Romanian first (German, French, Ukrainian later); language selection as the first onboarding step, UI language switchable in Profile; Paraglide JS (shipped in v4.2.0)
- [x] Avatar picker (12 rerollable options) + backup export/import (v4.4.0)

## Version 5 — shipped v5.0.0 (2026-09-03)

Sync + sharing + notifications, one major release.

- [x] Sync with the server — list saved and loaded across devices: local-first engine (`pwa/src/stores/sync/`), journal + three-way reconciliation + LWW, realtime SSE, offline behavior — see `pwa/docs/SYNC.md`
- [x] Multi-user support — shared lists with a group switcher on Profile, owner-gated invite by exact username, owner/member role badges, remove/leave flows (`SharedListCard` + `stores/sync/group-actions.ts`)
- [x] Family shopping-list flow on top of sharing — invites and roles surfaced in-app (owner / member)
- [x] In-app notifications for membership changes (realtime; Web Push deferred — D4)

## Version 6

- [x] App website — standalone marketing site (`web/`: hero + live stats + features + download + screenshots pages); live at `https://www.remindit.me` (deployed with the platform, Phase D 2026-09-04; localized URL routing + pre-MVP content pass in v5.3.0). Live PWA: `https://remindit.me`
- [x] Community of early adopters and feedback capture — Apache Answer sidecar (`https://feedback.remindit.me`, submit API, tag-seeded quick links, login-link flow, phase FB); **removed 2026-09-05** after live use (D13) — the Q&A board added more friction than value, no in-app substitute
- [x] **AI support chat (phase 1, 2026-09-07, branch `feat/ai-support-chat`)** — embedded VoltAgent support assistant in the pwa (`/assistant`), grounded on `bff/content/support-en.md`, English-only, with a model eval harness (`bun run model:eval`). Models chosen by eval: local `qwen2.5:7b`, remote `minimax/minimax-m3:free`. Shipped under evaluation — discarded or folded to a later phase based on model quality.
- [ ] Basic AI features — **phase 2+**: feedback capture (bugs/feature requests) via chat; app "commands" (show list, recommendations, `add "mustard"`); conversation language from user profile; persistent multi-thread memory
- [ ] Integration with LLMs (MCP, skills) — **phase 2+**: MCP server / skills to interact with other systems (e.g. "put my shopping list in calendar"); used across pwa/web/admin

## Wishlist

- [ ] Items might have attributes associated with them, such as photo, quantity, or price.
- [ ] Native application
- [ ] Notifications and live activities/updates