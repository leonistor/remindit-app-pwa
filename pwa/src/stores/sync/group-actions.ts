// Account-level group/membership actions the UI calls (F1/F2). Thin wrappers:
// each pulls the session token from $syncSession and delegates to bffApi —
// feature components never import the bff lib directly (stores → lib
// layering). Thrown strings follow the published error contract; the UI maps
// them at render time via sync-errors plus its own sharing-specific keys.

import {
  BffError,
  bffApi,
  type Group,
  type Member,
  type UserPublic,
} from "@/lib/bff-api"
import { switchGroup } from "./engine"
import { $syncSession } from "./session"

// Re-exported so feature components can type against these without touching
// the bff lib (same rationale as the wrappers themselves).
export type { Group, Member, UserPublic }

// Stable throw when signed out — same string the engine throws, already
// mapped to `syncErrorNotSignedIn` by sync-errors.
const requireToken = (): string => {
  const token = $syncSession.get()?.token
  if (!token) throw new Error("not signed in")
  return token
}

const listGroups = (): Promise<Group[]> => bffApi.listGroups(requireToken())

const listMembers = (groupId: string): Promise<Member[]> =>
  bffApi.listMembers(requireToken(), groupId)

const lookupUser = (username: string): Promise<UserPublic> =>
  bffApi.lookupUser(requireToken(), username)

const inviteMember = async (
  groupId: string,
  username: string
): Promise<Member> => {
  const token = requireToken()
  let user: UserPublic
  try {
    user = await bffApi.lookupUser(token, username)
  } catch (cause) {
    // Surface the lookup miss as the published contract string so the UI can
    // say "no such user" instead of a generic failure.
    if (cause instanceof BffError && cause.status === 404) {
      throw new Error("user not found")
    }
    throw cause
  }
  return bffApi.inviteMember(token, groupId, user.id)
}

const removeMember = (groupId: string, memberId: string): Promise<void> =>
  bffApi.removeMember(requireToken(), groupId, memberId)

const switchActiveGroup = (groupId: string): Promise<void> =>
  switchGroup(groupId)

export const groupActions = {
  listGroups,
  listMembers,
  lookupUser,
  inviteMember,
  removeMember,
  switchActiveGroup,
}
