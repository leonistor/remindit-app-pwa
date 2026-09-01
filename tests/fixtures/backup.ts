// Shared backup-envelope fixture for the import/restore view tests
// (onboarding shortcut + Profile import). Deliberately hand-written (NOT built
// through collectLocalData) so a store change can't mask a wiring regression —
// same policy as the parser tests in src/lib/local-data.test.ts, just in a
// shared location so the two view tests don't duplicate the shape.

import type { LocalDataEnvelope } from "@/lib/local-data"
import { DEFAULT_PALETTE_ID } from "@/lib/palettes"
import { APP_VERSION } from "@/version"

// A minimal but fully valid snapshot. `version` defaults to the running app's
// version so the default envelope never trips the newer-backup warning.
export function backupEnvelope(
  overrides: Partial<LocalDataEnvelope> = {}
): LocalDataEnvelope {
  return {
    version: APP_VERSION,
    exportedAt: "2026-08-15T09:30:00.000Z",
    data: {
      catalog: [
        {
          id: "item-restore-1",
          name: "Restored Apples",
          categoryId: "cat-restore",
        },
      ],
      categories: [
        {
          id: "cat-restore",
          name: "Restored Fruit",
          frequency: "weekly",
          color: 3,
        },
      ],
      list: [],
      history: [],
      user: {
        username: "restored-leo",
        firstName: "Leo",
        lastName: "Restored",
        email: "",
        avatar: "data:image/png;base64,AAAA",
      },
      theme: "dark",
      activePalette: DEFAULT_PALETTE_ID,
      selectedSort: "name",
      accordionOpen: null,
      onboarded: true,
      selectedDataset: "minimal",
      installDismissed: false,
    },
    ...overrides,
  }
}

/** Wrap an envelope as the JSON backup file a user would pick. */
export function backupFile(
  envelope: LocalDataEnvelope,
  name = "remindit-backup.json"
): File {
  return new File([JSON.stringify(envelope)], name, {
    type: "application/json",
  })
}

// A version whose major is one above the running app — always "newer" for the
// forward-compat gate, no matter when this test runs.
export function futureMajorVersion(): string {
  const major = Number.parseInt(APP_VERSION.split(".")[0], 10)
  return `${major + 1}.0.0`
}
