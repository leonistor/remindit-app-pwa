// Re-export shim — the domain models moved to `@remindit/common`
// (../common/src/models/types.ts) so every module can share them (the planned
// groups-with-shared-shopping-lists feature builds on these entities).
//
// All existing `@/stores/types` imports keep working unchanged. New code may
// import from `@remindit/common/models` directly; this shim exists so the
// migration can happen file-by-file instead of in one sweeping diff.
export * from "@remindit/common/models"
