# Changelog

All notable changes to Remindit will be documented in this file.

## v4.2.0 — 2026-09-01

_A calmer, more consistent feel throughout — plus a richer starter catalog and a friendlier first run._

### ✨ New Features

- **A consistent motion language**: the whole app now moves with one calm, tested motion system — catalog chips cascade in when you open a category, list items enter and exit smoothly, and the install and update prompts slide up from the bottom instead of popping in. If your device prefers reduced motion, everything still lands, just instantly
- **Richer starter catalog**: the Minimal starter dataset now includes 14 more everyday groceries (three per category), so a fresh install feels lived-in and the recommendations have more to learn from

### 🔧 Improvements

- **A more inviting first look**: on a fresh install the catalog now opens with its first two categories expanded (previously one), so the panel reads as populated right away
- **Reset & reseed with confidence**: the reset flow now shows a busy state while it works and a confirmation before you're sent back to your freshly seeded list
- **Onboarding polish**: the Next button on the welcome and profile steps is now the primary action, aligned to the right where your thumb expects it
- **A dedicated welcome video**: the onboarding's opening step now embeds its own shorter, calmer demo video

## v4.1.0 — 2026-08-31

_The catalog now shows how many recommendations each category holds — and the Help page got more accurate._

### ✨ New Features

- **Recommended-count badge**: each category header in the catalog shows a small count of its recommended items (overdue or due soon). It's reactive: add a recommended item to your list and the count drops — putting the item back won't inflate it again, since only items still waiting to be acted on are counted

### 🔧 Improvements

- **Autoplaying help videos**: the demo videos on the Help page now autoplay muted while in view, pause when you scroll away, and loop — falling back to native controls when your device prefers reduced motion
- **About stays in sync**: the About page now mentions the recommended-count badge

### 🐛 Fixes

- **Accurate Help copy**: removed a stale reference to a catalog-legend info icon that no longer exists — the pip legend lives right on the Help page — and corrected the quick-add description to match its real behavior

## v4.0.0 — 2026-08-31

_Share your list as an image, watch demo videos right inside the app, and take full control of your local data._

### ✨ New Features

- **Share your list**: a new Share page (menu → Share) turns the items you still need into a polished card image — grouped by category with their colors, ready to copy to your clipboard or download as a PNG and send to whoever's shopping with you. Checked-off items stay off the card, and it always renders in light colors so it reads well anywhere
- **Watch it in action**: first-run onboarding now opens with a short demo video of building a list, and the Help page embeds demo videos next to the tips they illustrate — each picking the variant that matches your theme (light/dark)
- **My local data**: Profile gains a "My local data" section — download everything Remindit has stored as a single JSON file, or erase it all and start fresh

### 🔧 Improvements

- **Suggested names, instantly yours**: the profile fields in onboarding pre-select their suggestions on focus, so your first keystroke replaces them
- **About page refreshed**: reorganized with section subtitles and now covering the Share page

### 🐛 Fixes

- **No accidental duplicates**: hammering Enter in quick-add can no longer create the same item twice
- **History across months**: history day groups now sort correctly at month boundaries
- **Chip hover ring**: the desktop hover ring on item chips stays visible at panel edges and against the page background
- **Calmer install prompt**: a blocked native install prompt no longer throws — the manual instructions dialog takes over

## v3.5.0 — 2026-08-30

_Catalog editing goes tactile — dialogs, swipe gestures, and a smarter quick-add with category pills._

### ✨ New Features

- **Category Pills in Quick Add**: When creating a new item, category pills appear below the autocomplete results — tap a pill to create the item immediately in that category, or press **Enter** to create with the selected pill (requires at least 3 letters). Selecting a pill when the name is too short just picks the category
- **Alphabetically Sorted Catalog**: Items within each category are now sorted alphabetically (A–Z) via locale-aware comparison, so renames and adds stay scannable
- **Contextual Catalog Legend**: A tailored legend at the top of the Catalog page explains how to edit (double-click on desktop / tap on mobile), swipe-to-reveal delete on mobile, the **⋯** kebab menu, and confirmation dialogs — adapting via mobile detection
- **Dialog + Swipe-to-Reveal Editing**: Double-click (desktop) or single tap (mobile) opens Item/Category dialogs for renaming; categories expose a kebab menu for discoverability and items expose a mobile swipe-to-reveal **Delete** with `AlertDialog` confirmation. Desktop keeps the Table layout while mobile uses stacked swipeable cards

### 🔧 Improvements

- **Quick Add in the Shopping List**: The **+** quick-add button moved from the global menu header into the Shopping List's floating row beside the sort control (unified `icon-lg`, primary) — so it lives where you actually build your list
- **Outline Add Buttons**: **Add category** now uses the outline variant like **Add item** for visual consistency — both header actions are secondary
- **Help & About**: Documentation updated to cover dialog editing, swipe-to-reveal, the catalog legend, alphabetical sorting, the floating quick-add row, and category pills

## v3.4.0 — 2026-08-30

_Your list gets lighter and more distinct — alphabetical sorting, distinct category colors, and a faster, more accessible shopping experience._

### ✨ New Features

- **Alphabetical Sorting**: The shopping-list sort button now cycles through three modes — category/name, most-recently-added, and a new alphabetical (A–Z) order — so you can find items the way you like
- **Distinct Category Colors**: Categories now get a stable sequential palette slot at creation (not a hash), so each of your first 12 categories gets a unique, consistent color across the catalog and your list — no more accidental duplicates like fridge/snacks sharing a hue
- **Faster Startup**: Secondary routes (About, Catalog, Changelog, Help, History, Profile) are now code-split and lazy-loaded, shrinking the initial bundle by ~34% so the main shopping view loads quicker
- **Accessible Landmark**: The main routed content is wrapped in a proper `<main>` landmark for screen-reader navigation

### 🔧 Improvements

- **Floating Sort Control**: The shopping-list sort toggle is now a floating Shark UI Float pinned to the top-right of the list — it no longer wastes a header row and uses the secondary variant for a cleaner look
- **Cleaner Catalog**: Only the first category accordion opens by default, and the recommendation legend/tooltip was removed from the available-items panel for a less cluttered view
- **Simpler Chips**: Shopping-list chips no longer show a redundant category-name badge — the color-coded tint already conveys the category
- **Fresh Avatars**: DiceBear avatar style switched from Cameo to Personas for a more personable default profile
- **Help & About**: Documentation updated to cover the new alphabetical sort and floating sort button

### 🐛 Fixes

- **History Categories Stay Accurate**: History rows now render the category name snapshot stored when the event happened, so renamed or deleted categories no longer show stale or missing labels; palette lookups for history and chips are now reactive via a `$categoryById` Map and stay correct after recolors
- **PWA Service Worker in Dev**: Fixed a false `navigateFallback` injection that caused the dev service worker to throw at evaluation time because `index.html` wasn't in the dev precache — detection now uses `NODE_ENV` instead of `process.argv`
- **Shopping List Layout**: Wrapped rows now pack to the top (`content-start`) instead of stretching, and deprecated category-visibility state was pruned

## v3.3.0 — 2026-08-29

_Your shopping history arrives, adding items is faster, and Remindit now nudges you to install it as a real app — all wrapped in a more robust offline experience._

### ✨ New Features

- **History**: A new History tab shows your last 7 days of shopping — every item added and removed — grouped by day so you can see what you've already picked up
- **Quick Add**: Tap the + button in the menu to add items on the fly. A grouped autocomplete suggests items by category and surfaces your recommendations as you type
- **Install Prompt**: Remindit now prompts you to install it to your home screen, with "Maybe later" and "No" options so the banner stays out of your way
- **Richer Install Gallery**: The install UI shows a screenshot gallery so the app looks great before you add it

### 🔧 Improvements

- **PWA Hardening**: Better safe-area handling, an in-app update prompt when a new version ships, and offline deep links that survive reloads
- **Responsive Shell**: The app is now constrained to a comfortable max width with tighter mobile insets
- **Help & About**: Documentation updated to cover History and Quick Add

### 🐛 Fixes

- **History Categories**: History rows now show the correct category name, captured as a snapshot when each event happened

## v3.2.0 — 2026-08-28

_Your first run just got friendlier: a guided onboarding flow sets up your profile and starter catalog, and a new Profile page puts your account front and center._

### ✨ New Features

- **First-Run Onboarding**: New users are walked through a quick setup that rolls a random profile (avatar + handle) and lets you pick a starter catalog before landing on your list
- **Profile Page**: Settings becomes Profile — manage your name, avatar, starter catalog, color palette, and reset or reseed your data, all from one place

### 🔧 Improvements

- **Menu Avatar**: The "RemindIt" wordmark is now your user avatar, linking straight to Profile (the logo still takes you home)
- **Bigger Onboarding Roll**: The "roll a new profile" button is larger and more inviting on the welcome screen

## v3.1.0 — 2026-08-27

_Categorical colors grow up: a managed palette system with a palette picker in Settings, smarter category ordering, and crisper, more accessible color contrast._

### ✨ New Features

- **Palette Picker**: Choose your categorical color palette from Settings — Remindit now ships a pool of palettes (Van Gogh is the new default) and remembers your selection
- **Categorical Palette Pool**: Category colors are backed by a dedicated palette pool, eliminating color drift between the catalog and the shopping list
- **Palette Preview**: The picker shows a live preview of each palette's colors above the options so you can choose at a glance

### 🔧 Improvements

- **Smarter Category Order**: Catalog categories are now sorted by frequency, so the items you reach for most sit at the top
- **Consistent Contrast**: Solid palette backgrounds with WCAG-compliant text replace the old dimmed translucency, and a theme-aware muted tint keeps selected items readable in both light and dark mode

### 🐛 Fixes

- Fixed cross-panel color drift by routing all category colors through the shared palette pool
- Inline Listbox now drives the palette chooser, with the preview rendered above the options for a cleaner layout

---

## v2.0.0 — 2026-08-27

_Phase 2 lands: inline catalog editing, a unified menu, and smoother item moves — Remindit now learns your habits and puts full catalog control at your fingertips._

### ✨ New Features

- **Inline Catalog Editing**: Click any item or category name to rename it in place; catalog items are now organized into collapsible sections rendered in a table
- **Unified Menu**: A single hamburger menu replaces the navigation; the brand mark now jumps straight to the Shopping list
- **Smooth Item Moves**: Items animate as they travel between the catalog and your shopping list (View Transitions)
- **Categorical Colors**: Item colors now come from a dedicated categorical palette, independent of button styling

### 🔧 Improvements

- Unified border treatment for selected vs. available items; selected items are now dimmed in the catalog

### 🐛 Fixes

- Footer no longer stays pinned to the viewport on long pages (Catalog, Changelog) — it scrolls with the content
- Fixed the category-frequency picker using an incorrect collection

---

## v1.3.0 — 2026-08-26

_Catalog editing, sorting, and a built-in changelog arrive — plus your panel and list preferences are now remembered._

### ✨ New Features

- **Manage Your Catalog**: Add, edit, and delete catalog items and categories on the Catalog page. Deleting a category moves its items to "Uncategorized"; deleting an item also removes it from your active list
- **Ordering Controls**: In the shopping list, toggle category grouping and sort by category/name or by most recently added — your choice is remembered
- **Category Badges**: Items in your shopping list now show a colour-coded category badge above the name
- **Reset & Reseed**: From Settings, reset the app or reseed it from the selected demo dataset
- **Changelog Page**: A new in-app Changelog (linked from the footer version and the About page) shows what's new at a glance

### 🔧 Improvements

- **Remembered Panel State**: The open/closed state of category accordions in the catalog is now saved across reloads

---

## v1.2.0 — 2026-08-25

_Recommendations arrive! Remindit now learns from your shopping history to suggest what you'll likely need next, plus a round of polish and new help content._

### ✨ New Features

- **Item Recommendations**: Remindit now learns from your shopping history and suggests items you'll likely need soon, scored by how overdue they are
- **Recommendation Indicators**: Items that are due for a re-buy now show a colour-coded indicator, with a legend in the items panel so you always know what the colours mean
- **Item Detail Drawer**: Tap an item to open a detail view with more information at a glance
- **About & Help Pages**: Expanded, readable About and Help content to get the most out of Remindit
- **"Coming Soon" Cards**: Not-yet-ready pages now show a friendly icon card instead of a blank screen
- **Demo History**: The app can seed a simulated 6-month shopping history so you can explore recommendations right away

### 🔧 Improvements

- **Readability**: Switched to the Atkinson Hyperlegible Next font app-wide for clearer text
- **Navigation**: Renamed the "List" menu item to "Shopping list" and made it visible on mobile
- **Version Footer**: A discreet version label now appears in the app for easy reference

### 🐛 Fixes

- Fixed recommendation indicators being clipped inside accordions
- Moved the recommendation dot to a clean top-right corner badge
- Right-aligned menu items while keeping the theme toggle pinned to the far right

---

## v1.1.0 — 2026-08-24

### ✨ New Features

- **Mobile Navigation**: Added responsive hamburger menu for smaller screens, making it easy to navigate on phones and tablets
- **Page Routing**: Navigate between different views of the app with client-side routing
- **Shopping Lists**: View and manage your shopping lists with dedicated panels
- **Theme Switching**: Choose between dark, light, or system theme — your preference is remembered
- **Install as App**: Install Remindit on your device like a native app via PWA support
- **App Icon**: Full PWA favicon set for a polished look on any device
- **Data Layer**: Restructured state management for better performance and reliability
- **Seed Data**: Improved category frequencies and dataset tracking for better defaults

### 🔧 Improvements

- **Panel Design**: Improved typography and visual hierarchy across all panels
- **Smooth Animations**: Shopping list panel now animates smoothly when items change
- **Accordions**: Panels open by default for quicker access to your lists
- **Compact Theme Toggle**: Single-icon toggle that cycles through themes on click
- **Unified Styles**: Consolidated stylesheets for faster load times
- **Menu Layout**: App logo displayed in menu with better spacing

### 🐛 Fixes

- Fixed panel titles not displaying correctly
- Shopping list panels now scroll properly when content overflows
- Fixed theme toggle not rendering in some layouts

---

## v0.1 — 2026-08-23

_Initial release of Remindit — a PWA shopping list app built with React, Rsbuild, and Nanostores._
