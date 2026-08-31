# Project outline

This project is a Progressive Web App (PWA) to manage a personal shopping list.

## [x] Version 1

- [x] The user has `items` to be added to the shopping `list`. The items are organized into `categories`. Adding/removing items from the list is logged into `history`.
- [x] The use data is: `name`, `photo`. If no data is available, the user is prompted to provide it or accept default values, randomly generated.
- [x] The main screen shows the list of items, organized by category. Controls are available to add/remove items, and to edit items and categories.

## [x] Version 2

- [x] Based on the user's shopping history, the app provides item recommendations.
- [x] The algorithm used for recommendations is either a time-series or a collaborative filtering algorithm. TBD.
- [x] Users will be able to add, edit, and remove items and categories.
- [x] Display ordering options will be available for categories, items, and the shopping list.

## [x] Version 3 — shipped as v3.1.0–v3.4.0

Core PWA + personalization slice. All items below are live (see `CHANGELOG.md`).

- [x] Categorical color palettes (pool in `seed/palettes.json`, picker in Profile, Van Gogh default) — distinct sequential slots, WCAG contrast, reactive `$categoryById`
- [x] Basic user profile + first-run onboarding (2-step: rollable `generate-random-username` + DiceBear avatar, dataset picker, `/onboarding` gate, `src/stores/onboarding.ts`)
- [x] Inspect history (`/history`, grouped by day, snapshot `categoryName`)
- [x] Quick search+add (`+` → grouped `Autocomplete`, recommendation-aware, create-under-Uncategorized)
- [x] Automate screenshots in PWA manifest (`scripts/generate-mobile-screenshot.ts`, light/dark gallery in `README.md`)
- [x] PWA checklist & hardening — installability (manifest + SW `fetch` + HTTPS + maskable icons), offline shell, `navigateFallback`, safe-area, standalone mode, update prompt (`src/components/update-prompt.tsx`), `docs/PWA-CHECKLIST.md` / `docs/DEPLOY.md`
- [x] App updates in browser (SW update flow, `UpdatePrompt` wired in `src/router.tsx`)
- [x] Help content — text ( `src/views/help.tsx`, `src/views/about.tsx`, `src/views/onboarding.tsx` copy; updated for floating sort + alphabetical A–Z in v3.4)
- [x] Internal hardening pre-V4 — hooks out of `src/stores` barrel, cross-store flows in `src/stores/commands.ts`, pure helpers in `src/lib/` (`quick-add`, `history-view`, `display`, `pwa-install`), palette seeding consolidation, history snapshot + palette reactivity fixes

## [ ] Version 4 — in progress

- [x] [DESIGN.md](../DESIGN.md) — design system as shipped (contributors, text-only)
- [ ] Share page (`/share`): export the current shopping list as a PNG image — light-theme branded card, unchecked items grouped by category, download + copy-to-clipboard (`@zumer/snapdom`)
- [ ] Help content: guided tour (videos shipped — Help page embeds 5 demo videos with theme-matched variants)
- [x] Add license (AGPL-3 LICENSE.txt at repo root)
- [ ] App website (standalone marketing/docs site beyond the deployed PWA at `https://remindit.parsedwink.com`)
- [ ] Community of early adopters and feedback capture (see `docs/LINKS.md#feedback`)

## [ ] Version 5

- [ ] Multi-user support will be added, allowing multiple users to share the same list and collaborate in real-time.
- [ ] Sync with the server will be implemented to allow the list to be saved and loaded across devices.
- [ ] The primary use case will be family shopping lists, where multiple users can share and collaborate on a single list.

## [ ] Version 6

- [ ] Basic AI features
- [ ] Integration with LLMs (MCP, skills)

---

# Wishlist

- [ ] Items might have attributes associated with them, such as photo, quantity, or price.
- [ ] Multi-language support
- [ ] Native application
- [ ] Notifications and live activities/updates
