// Current user profile. Persisted; random defaults are assigned on first run
// when no name is present (handled in ./index during seeding).

import type { User } from "./types"
import { jsonStore, STORAGE_KEYS } from "./persistence"

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

export function randomUser(): User {
  const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]
  const photo = `https://i.pravatar.cc/150?u=${crypto.randomUUID()}`
  return { name, photo }
}

export { $user }
