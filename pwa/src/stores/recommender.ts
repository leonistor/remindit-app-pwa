// Re-export shim — the recommendation engine moved to `@remindit/common`
// (../common/src/recommender.ts) so the BFF can run the same scoring for the
// AI "recommend" command and the context route (Task B, D15). All existing
// `@/stores/recommender` imports keep working unchanged; the shared
// FREQ_TO_DAYS table is re-exported here too (it also lives in common/seeds).
export * from "@remindit/common/recommender"
export { FREQ_TO_DAYS } from "@remindit/common/seeds"