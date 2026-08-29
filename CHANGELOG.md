# Changelog

All notable changes to Remindit will be documented in this file.

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
