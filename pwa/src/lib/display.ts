// Pure display helpers shared across components/stores. Kept in `src/lib` (no
// DOM/store deps) so they are unit-testable without a React environment and stay
// a single source of truth.

// Core initials from a single whitespace-separated name string. Uses the first
// and last tokens when there are multiple, otherwise the first two characters.
export function initials(name: string, emptyFallback = ""): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? emptyFallback).toUpperCase()
}

// Avatar initials for a user profile: prefers the full name, falling back to the
// username (e.g. the menu avatar). Shared so the menu and the offline SVG avatar
// generator can never drift on initials casing.
export function avatarInitials(user: {
  firstName: string
  lastName: string
  username: string
}): string {
  const fromName = `${user.firstName} ${user.lastName}`.trim()
  return initials(fromName || user.username, "?")
}
