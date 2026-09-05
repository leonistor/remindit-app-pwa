// Deterministic, offline-friendly avatar for seeded users: initials on a
// colored background as an inline SVG data URI. Mirrors the pwa's `localAvatar`
// (pwa/src/stores/user.ts) so seeded profiles look like app-generated ones —
// no network requests, renders everywhere the `avatar` text field is shown.

/** Two-letter initials from a first/last name (or the username alone). */
export function initialsOf(firstOrUsername: string, lastName = ""): string {
  const first = firstOrUsername.trim() || "?"
  const second = lastName.trim()
  if (second) return `${first[0]}${second[0]}`.toUpperCase()
  return first.slice(0, 2).toUpperCase()
}

/**
 * Build an initials avatar data URI. The background hue is derived from `seed`
 * (typically the username) so re-runs produce identical avatars.
 */
export function initialsAvatar(
  firstOrUsername: string,
  lastName = "",
  seed: string
): string {
  const initials = initialsOf(firstOrUsername, lastName)

  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="24" fill="hsl(${hue}, 55%, 45%)"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="64" font-weight="600">${initials}</text></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}