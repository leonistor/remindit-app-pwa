// Current user profile. Persisted; random defaults are assigned on first run
// when no name is present (handled in ./index during seeding).

import { jsonStore, STORAGE_KEYS } from "./persistence"
import type { User } from "./types"

const NAME_POOL = [
  "Patricia",
  "Sam",
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
]

const $user = jsonStore<User>(STORAGE_KEYS.user, { name: "", photo: "" })

export function getUser(): User {
  return $user.get()
}

export function updateUser(patch: Partial<User>): void {
  $user.set({ ...$user.get(), ...patch })
}

// Generates a deterministic, offline-friendly avatar as an inline SVG data URI
// (initials on a colored background). Avoids external network requests so the
// app stays fully local-first.
export function localAvatar(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = (
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "")
  ).toUpperCase()

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="24" fill="hsl(${hue}, 55%, 45%)"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="64" font-weight="600">${initials}</text></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function randomUser(): User {
  const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]
  const photo = localAvatar(name)
  return { name, photo }
}

export { $user }
