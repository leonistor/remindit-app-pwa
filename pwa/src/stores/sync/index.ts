// Sync barrel (phase 5): the public surface the UI and app bootstrap use.
// The engine's internals (reconcile, specs) stay private.

export {
  $syncState,
  initSync,
  recoverActiveGroup,
  signIn,
  signOut,
  signUp,
  switchGroup,
} from "./engine"
export { $syncSession } from "./session"
export { groupActions } from "./group-actions"
export type { Group, Member, UserPublic } from "./group-actions"
