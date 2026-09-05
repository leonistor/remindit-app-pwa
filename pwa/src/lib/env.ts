// Central env/config access (item 8): Rsbuild exposes `PUBLIC_*` vars (and
// DEV/PROD/MODE) through `import.meta.env` at build time. Every consumer reads
// them through this module — the single place that knows the env shape — so a
// var rename or a new public var touches one file, not a grep across stores.
// Defaults that are domain-specific (seed dataset id) stay at their consumer.

import { DEFAULT_BFF_URL } from "./sync-constants"

declare global {
  interface ImportMeta {
    env?: {
      DEV?: boolean
      PROD?: boolean
      MODE?: string
      // Public (client-exposed via Rsbuild's `PUBLIC_` convention). Selects the
      // seed dataset on first run — see .env / .env.example.
      PUBLIC_DATASET?: string
      // BFF origin — sync RPC + the /pb/* data-plane forwarder (phase 5).
      PUBLIC_BFF_URL?: string
      // Set to "0" in .env to skip the first-run history seed.
      PUBLIC_SEED_HISTORY?: string
      [key: string]: unknown
    }
  }
}

export const env = {
  get dev(): boolean {
    return import.meta.env?.DEV === true
  },
  /** BFF origin for the account RPC + /pb/* forwarder (with a dev default). */
  get bffUrl(): string {
    return import.meta.env?.PUBLIC_BFF_URL ?? DEFAULT_BFF_URL
  },
  /** Build-time seed dataset id (validation/defaults live in seed resolveDatasetId). */
  get datasetId(): string | undefined {
    return import.meta.env?.PUBLIC_DATASET
  },
  /** First-run history seed disabled when PUBLIC_SEED_HISTORY=0. */
  get seedHistoryEnabled(): boolean {
    return import.meta.env?.PUBLIC_SEED_HISTORY !== "0"
  },
}