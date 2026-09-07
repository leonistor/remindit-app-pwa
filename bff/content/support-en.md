# RemindIt — Support knowledge base (English)

This document is the authoritative grounding for the in-app support assistant.
It is derived from the current Help and About pages and the changelog, kept in
sync with the app at release time. Answer user questions strictly from this
content; if a topic is not covered, say you don't have an answer and suggest
asking again later.

## What RemindIt is

RemindIt is a Progressive Web App for managing a personal shopping list. Add
it to your home screen and it works offline — your data stays on your device.

## Getting started

- First-run setup walks you through rolling a profile and picking a starter
  catalog (a quick 4-step flow: 4 steps, onboarding video walks the whole
  thing, a random profile with avatar + handle is rolled, then you pick a
  starter catalog before landing on your list).
- Your user avatar sits in the menu and links straight to your Profile; the
  round logo still takes you home.

## Building your list

- Tap a catalog item to add it to your list; tap it again to remove it.
- Use the floating sort button in the top-right of your list (next to the +)
  to cycle between category, most-recent, and alphabetical (A–Z) order — your
  choice is remembered.
- Quick add: tap the + in the floating row at the top of your list to add a
  new item. A grouped autocomplete suggests items by category and surfaces
  your recommendations as you type. Once you have enough shopping history,
  quick add suggests only your recommended items. When creating a new item,
  category pills appear below the results: tap a pill to create in that
  category immediately, or press Enter to create with the selected pill (at
  least 3 letters).

## Catalog

- Open Catalog from the menu to manage items and categories. Collapsible
  categories are sorted by how often you reach for them, with items sorted
  alphabetically (A–Z) inside.
- Rename by double-click (desktop) or tap (mobile); the ⋯ menu edits or
  deletes a category, and swiping an item left (mobile) reveals Delete — all
  confirmed in dialogs.
- Deleting a category moves its items to Uncategorized. Deleting an item also
  removes it from your list.

## Personalizing

- Change your name, username, and categorical color palette (with a live
  preview) from Profile.
- Switch or reseed your catalog from Profile too.
- RemindIt speaks English and Română — pick yours from Profile on first run
  (switching reloads the app).

## Recommendations

- A red pip means an item is overdue — past when you'd normally buy it. An
  amber pip means it's due soon.
- The count next to a category name in the catalog is how many of its items
  are recommended right now — add one and the count drops.
- RemindIt learns your shopping rhythm by remembering when you add each item —
  suggestions grow more confident the more you shop, and it stays quiet about
  things you rarely buy or already have on your list.

## History

- The History tab shows your recent activity — every add and remove — grouped
  by day and limited to the last 7 days.
- The category label on each row is a snapshot taken when the event happened,
  so renaming a category later doesn't rewrite it.

## Share

- Open Share from the menu to preview your list as a card image — today's date
  and the items still on it, grouped by category with their colors.
- Copy image puts the card on your clipboard (where your browser supports it)
  and Download PNG saves a file — send it to whoever's shopping with you.
- Checked-off items never make it onto the card, and the image always uses
  light colors so it reads well in any chat — even in dark mode.

## Sync across devices

- From Profile, open Sync & account to sign in and turn on sync. Your account
  keeps your list, catalog, and history in step across all your devices.
- Everything still works offline — sync is optional, and nothing is uploaded
  until you sign in.
- Sharing a list is simple too: the owner invites people by exact username,
  and members switch or leave the list from Profile.

## Your data

- Everything is saved locally in your browser — no account needed. Sync is
  optional: nothing is uploaded until you sign in.
- First setup seeds a starter catalog plus a simulated shopping history, so
  recommendations work right away.
- Your data stays yours: download a backup file from Profile and restore it
  on any device — a fresh install offers the same restore during onboarding.
- Reset or reseed anytime from Profile — your profile and theme preference are
  kept.

## What's coming (roadmap, not shipped)

- Item attributes (photo, quantity, price) — the remaining piece of Phase 3.
- Notifications — in-app pings about list activity, so you'll know when
  something changes on your shared list.

## Version notes

- The app is open source; code is on GitHub (leonistor/remindit-app-pwa).
- The marketing site is at remindit.me.
