// Current user profile. Persisted; random defaults (with a DiceBear avatar) are
// assigned during onboarding via `completeOnboarding`. `randomUser` here is a
// synchronous offline fallback (initials SVG) used only when no generated
// profile is supplied to `seedFromDataset` — the rich DiceBear + username
// generator lives in `src/lib/profile-generator.ts` and is loaded lazily so it
// stays out of the main bundle.

import { initials } from "@/lib/display"
import { jsonStore, STORAGE_KEYS } from "./persistence"
import type { UserProfile } from "./types"

const EMPTY_PROFILE: UserProfile = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

const $user = jsonStore<UserProfile>(STORAGE_KEYS.user, EMPTY_PROFILE)

export function getUser(): UserProfile {
  return $user.get()
}

export function updateUser(patch: Partial<UserProfile>): void {
  $user.set({ ...$user.get(), ...patch })
}

// Generates a deterministic, offline-friendly avatar as an inline SVG data URI
// (initials on a colored background). Avoids external network requests so the
// app stays fully local-first. Used as the fallback when the DiceBear generator
// is not in play (e.g. a sync reseed without a generated profile).
export function localAvatar(name: string): string {
  const initialsStr = initials(name)

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="24" fill="hsl(${hue}, 55%, 45%)"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="64" font-weight="600">${initialsStr}</text></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Synchronous fallback profile. Not used for first-run onboarding (that path
// uses the async DiceBear generator); kept for the reseed-without-profile case.
export function randomUser(): UserProfile {
  const username = `user-${Math.random().toString(36).slice(2, 8)}`
  return {
    username,
    firstName: "",
    lastName: "",
    email: "",
    avatar: localAvatar(username),
  }
}

export { $user }
