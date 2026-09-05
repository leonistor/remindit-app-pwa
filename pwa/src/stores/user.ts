// Current user profile. Persisted; random defaults (with a DiceBear avatar) are
// assigned during onboarding via `completeOnboarding`. `randomUser` here is a
// synchronous offline fallback (initials SVG) used only when no generated
// profile is supplied to `seedFromDataset` — the rich DiceBear + username
// generator lives in `src/lib/profile-generator.ts` and is loaded lazily so it
// stays out of the main bundle.

import { initialsAvatar } from "@remindit/common/seeds"
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
//
// Delegates to common's `initialsAvatar(name, "", name)`: for the single-token
// names passed here (usernames/first-run names have no spaces) common's
// `initialsOf(name, "")` returns the same first-two-characters-upcased initials
// the pwa's old local `initials()` produced, so behavior is preserved.
export function localAvatar(name: string): string {
  return initialsAvatar(name, "", name)
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
