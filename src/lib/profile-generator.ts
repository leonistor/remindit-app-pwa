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

export async function generateRandomProfile(): Promise<UserProfile> {
  const [{ default: generateRandomUsername }, core, cameoMod] =
    await Promise.all([
      import("generate-random-username"),
      import("@dicebear/core"),
      import("@dicebear/styles/cameo.json"),
    ])

  // generate-random-username yields a handle like "humble-shrew". We derive the
  // display name by splitting it into first/last (capitalized) and keep the
  // handle verbatim as the username.
  const username = generateRandomUsername({ separator: "-" })
  const [first, last] = username.split("-")

  const { Style, Avatar } = core
  const style = new Style(cameoMod.default as ConstructorParameters<typeof Style>[0])
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
