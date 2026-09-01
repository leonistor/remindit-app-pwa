// Lazy profile generator used by onboarding and the Profile page.
//
// Both `@dicebear/core` / `@dicebear/styles` and `generate-random-username` are
// dynamically imported so Rspack code-splits them into a separate chunk. They
// are therefore NOT part of the main shopping/catalog bundle — only the two
// flows that need them (onboarding + Profile) pull them in. The store/seed layer
// never imports this module, keeping first paint light.

import type { UserProfile } from "@/stores/types"

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

// One avatar offering in the Profile picker: the seed is only the listbox
// item value (identity within a batch); the dataUri is what gets persisted.
export interface AvatarOption {
  seed: string
  dataUri: string
}

// Random avatar batch for the Profile picker. Seeds use crypto.randomUUID so
// a batch can never contain duplicates (Math.random strings could collide in
// principle) and every open/reroll yields a guaranteed-fresh set.
export async function generateAvatarOptions(
  count = 12
): Promise<AvatarOption[]> {
  const [core, personasMod] = await Promise.all([
    import("@dicebear/core"),
    import("@dicebear/styles/personas.json"),
  ])

  // The Style parse is done once per batch; each Avatar render is cheap.
  const { Style, Avatar } = core
  const style = new Style(
    personasMod.default as ConstructorParameters<typeof Style>[0]
  )

  return Array.from({ length: count }, () => {
    const seed = crypto.randomUUID()
    return { seed, dataUri: new Avatar(style, { seed }).toDataUri() }
  })
}

export async function generateRandomProfile(): Promise<UserProfile> {
  const [{ default: generateRandomUsername }, core, personasMod] =
    await Promise.all([
      import("generate-random-username"),
      import("@dicebear/core"),
      import("@dicebear/styles/personas.json"),
    ])

  // generate-random-username yields a handle like "humble-shrew". We derive the
  // display name by splitting it into first/last (capitalized) and keep the
  // handle verbatim as the username.
  const username = generateRandomUsername({ separator: "-" })
  const [first, last] = username.split("-")

  const { Style, Avatar } = core
  const style = new Style(
    personasMod.default as ConstructorParameters<typeof Style>[0]
  )
  // Inline SVG as a data URI — self-contained, no network, easy to persist.
  const avatar = new Avatar(style, { seed: username }).toDataUri()

  return {
    username,
    firstName: capitalize(first ?? ""),
    lastName: capitalize(last ?? ""),
    email: "",
    avatar,
  }
}
