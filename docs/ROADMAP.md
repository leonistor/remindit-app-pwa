# Project outline

This project is a Progressive Web App (PWA) to manage a personal shopping list.

The phases of development are:

- Phase 1: basic functionality
- Phase 2: items recommendations
- Phase 3: extra functionality: color palettes, item attributes
- Phase 4: multi-user and sync with server with real-time collaboration

## Phase 1 (v 1.0)

The user has `items` to be added to the shopping `list`. The items are organized into `categories`. Adding/removing items from the list is logged into `history`.

The use data is: `name`, `photo`. If no data is available, the user is prompted to provide it or accept default values, randomly generated.

The main screen shows the list of items, organized by category. Controls are available to add/remove items, and to edit items and categories.

## Phase 2 (v 2.0)

Based on the user's shopping history, the app provides item recommendations.

The algorithm used for recommendations is either a time-series or a collaborative filtering algorithm. TBD.

Users will be able to add, edit, and remove items and categories.

Display ordering options will be available for categories, items, and the shopping list.

## Phase 3 (v 3.0)

Categorical color palettes will be available to the user to choose from. They will be used to color-code items in the list.

Items might have attributes associated with them, such as photo, quantity, or price.

## Phase 4 (v 4.0)

Multi-user support will be added, allowing multiple users to share the same list and collaborate in real-time.

Sync with the server will be implemented to allow the list to be saved and loaded across devices.

The primary use case will be family shopping lists, where multiple users can share and collaborate on a single list.
