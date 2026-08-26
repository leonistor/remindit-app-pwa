# Changelog

All notable changes to Remindit will be documented in this file.

## [Unreleased]

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
