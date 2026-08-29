// Onboarding + dataset-selection state.
//
// `onboarded` gates the first-run experience: until it is true the app redirects
// to the onboarding flow. `selectedDataset` persists the user's chosen seed
// dataset (set during onboarding or reset) so subsequent runs and reseeds use it
// instead of the build-time `PUBLIC_DATASET` env var. `completeOnboarding` lives
// in `./index` (it needs `seedFromDataset` + `updateUser`) to avoid an import
// cycle; this module stays free of those dependencies.

import { resolveDatasetId } from "seed"
import { jsonStore, STORAGE_KEYS } from "./persistence"

// False until onboarding finishes. Existing users (fresh cache) start at false
// and are walked through onboarding.
const $onboarded = jsonStore<boolean>(STORAGE_KEYS.onboarded, false)

// The dataset id chosen during onboarding / reset. Empty means "not chosen yet"
// → resolved from the build-time PUBLIC_DATASET (which itself falls back to the
// default dataset id).
const $selectedDatasetId = jsonStore<string>(STORAGE_KEYS.selectedDataset, "")

export function isOnboarded(): boolean {
  return $onboarded.get() === true
}

export function setOnboarded(value: boolean): void {
  $onboarded.set(value)
}

export function getSelectedDatasetId(): string {
  return $selectedDatasetId.get()
}

export function setSelectedDataset(id: string): void {
  $selectedDatasetId.set(id)
}

// Resolves the effective dataset id: the user's stored choice, else the
// build-time PUBLIC_DATASET, else the registered default.
export function resolveSelectedDataset(): string {
  return resolveDatasetId(
    $selectedDatasetId.get() || import.meta.env?.PUBLIC_DATASET
  )
}

export { $onboarded, $selectedDatasetId }
