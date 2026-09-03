// Shared-list card (F1/F2): the group surface for a signed-in sync session —
// active-group switcher, members with roles, owner invite, leave/remove.
// Sits under SyncCard in Profile and renders nothing while sync is off; the
// engine owns the active-group model (docs/SYNC.md §Groups & sharing) — this
// is just the control surface, the same split as sync-card.

import { useStore } from "@nanostores/react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  type ListCollection,
  useListCollection,
} from "@/components/ui/custom/collection"
import { Button } from "@/components/ui/custom/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { avatarInitials } from "@/lib/display"
import { syncErrorMessage } from "@/lib/sync-errors"
import { m } from "@/paraglide/messages"
import {
  $syncSession,
  $syncState,
  groupActions,
  recoverActiveGroup,
  type Group,
  type Member,
} from "@/stores/sync"

// Card-local error mapping: the two sharing-specific contract strings get
// dedicated messages ("user not found" is thrown by groupActions.inviteMember
// on the lookup 404; "group not found" is engine.ts switchGroup's throw when
// the group is not among the session's groups, i.e. not a member) — everything
// else funnels through syncErrorMessage, which keeps the generic fallback.
const sharedListError = (raw: string): string => {
  const normalized = raw.trim().toLowerCase()
  if (normalized === "user not found") return m.sharedListErrorNotFound()
  if (normalized === "group not found" || normalized.includes("member"))
    return m.sharedListErrorNotMember()
  return syncErrorMessage(raw)
}

const toRawError = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export function SharedListCard() {
  const sync = useStore($syncState)
  const session = useStore($syncSession)

  const [groups, setGroups] = useState<Group[] | null>(null)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [switchBusy, setSwitchBusy] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState("")
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  // "Latest load wins" token: an older response resolving after a group
  // switch or refetch must not overwrite the newer result.
  const loadTokenRef = useRef(0)

  // Groups + members loader. State is read via the stores' .get() (not
  // reactive deps) so the callback identity stays stable; `reset` clears the
  // lists first (group change / mount), "in-place" refetches without a
  // loading flash (after invite/remove).
  const load = useCallback(async (mode: "reset" | "in-place") => {
    const current = $syncState.get()
    if (current.status !== "online" || !current.groupId) return
    const token = ++loadTokenRef.current
    if (mode === "reset") {
      setGroups(null)
      setMembers(null)
    }
    setLoadError(null)
    try {
      const [nextGroups, nextMembers] = await Promise.all([
        groupActions.listGroups(),
        groupActions.listMembers(current.groupId),
      ])
      if (loadTokenRef.current !== token) return
      setGroups(nextGroups)
      setMembers(nextMembers)
    } catch (cause) {
      if (loadTokenRef.current !== token) return
      setLoadError(toRawError(cause))
    }
  }, [])

  // Fresh groups + members whenever the engine reports a new active group.
  useEffect(() => {
    if (sync.status !== "online" || !sync.groupId) return
    void load("reset")
  }, [load, sync.status, sync.groupId])

  const { collection: groupCollection, set: setGroupItems } =
    useListCollection<Group>({
      initialItems: [],
      itemToValue: (group) => group.id,
      itemToString: (group) => group.name,
    })

  useEffect(() => {
    setGroupItems(groups ?? [])
  }, [groups, setGroupItems])

  if (sync.status === "off" || !session) return null

  const groupId = sync.groupId
  const refresh = () => void load("in-place")
  const activeGroup = groups?.find((group) => group.id === groupId) ?? null
  // The owner flag prefers group.owner (server truth); the members-based
  // fallback covers the window while groups are still loading.
  const isOwner = activeGroup
    ? activeGroup.owner === session.userId
    : (members ?? []).some(
        (member) => member.role === "owner" && member.user.id === session.userId
      )
  const selfMember =
    (members ?? []).find((member) => member.user.id === session.userId) ?? null

  const switchTo = async (nextId: string) => {
    if (!nextId || nextId === groupId) return
    setSwitchBusy(true)
    setSwitchError(null)
    try {
      await groupActions.switchActiveGroup(nextId)
      // A successful switch re-points $syncState.groupId — the load effect
      // refetches groups + members for the new group on its own.
    } catch (cause) {
      setSwitchError(toRawError(cause))
    } finally {
      setSwitchBusy(false)
    }
  }

  // Leave (self) and remove (owner → someone else) share a path: both call
  // recoverActiveGroup afterwards, a no-op while the active group stays
  // valid but re-points the device (fresh "My list" fallback) on self-leave.
  const removeMemberRow = async (memberId: string) => {
    if (!groupId) return
    setRemovingId(memberId)
    setActionError(null)
    try {
      await groupActions.removeMember(groupId, memberId)
      await recoverActiveGroup()
      refresh()
    } catch (cause) {
      setActionError(toRawError(cause))
    } finally {
      setRemovingId(null)
    }
  }

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    const username = inviteName.trim()
    if (!username || !groupId) return
    setInviteBusy(true)
    setInviteError(null)
    try {
      await groupActions.inviteMember(groupId, username)
      setInviteName("")
      refresh()
    } catch (cause) {
      setInviteError(toRawError(cause))
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader
        title={m.sharedListTitle()}
        description={m.sharedListDescription()}
      />
      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="shared-list-group">
            {m.sharedListSwitchLabel()}
          </FieldLabel>
          <Select
            collection={groupCollection as unknown as ListCollection<unknown>}
            value={groups === null || !groupId ? [] : [groupId]}
            disabled={switchBusy || groups === null}
            onValueChange={(details) => {
              const next = details.value[0]
              if (next) void switchTo(next)
            }}
          >
            <SelectTrigger id="shared-list-group" className="w-full">
              <SelectValue placeholder={m.loading()}>
                {activeGroup?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(groups ?? []).map((group) => (
                <SelectItem key={group.id} item={group}>
                  <span className="flex items-center gap-2">
                    {group.name}
                    {group.owner === session.userId && (
                      <Badge size="sm" variant="default">
                        {m.sharedListRoleOwner()}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {switchError && (
          <p className="text-destructive text-sm">
            {sharedListError(switchError)}
          </p>
        )}
        {loadError && (
          <p className="text-destructive text-sm">
            {sharedListError(loadError)}
          </p>
        )}

        {members !== null && members.length > 0 && (
          <ul className="flex flex-col gap-3">
            {members.map((member) => {
              const isSelf = member.user.id === session.userId
              const displayName =
                [member.user.firstName, member.user.lastName]
                  .filter(Boolean)
                  .join(" ") || member.user.username
              return (
                <li key={member.id} className="flex items-center gap-3">
                  <Avatar size="sm">
                    {member.user.avatar ? (
                      <AvatarImage src={member.user.avatar} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {avatarInitials(member.user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{displayName}</span>
                    <span className="truncate text-muted-foreground text-xs">
                      @{member.user.username}
                    </span>
                  </div>
                  <Badge
                    size="sm"
                    variant={member.role === "owner" ? "default" : "outline"}
                  >
                    {member.role === "owner"
                      ? m.sharedListRoleOwner()
                      : m.sharedListRoleMember()}
                  </Badge>
                  <div className="ms-auto flex items-center gap-2">
                    {isSelf ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={removingId !== null}
                        onClick={() => setLeaveOpen(true)}
                      >
                        {m.sharedListLeaveButton()}
                      </Button>
                    ) : isOwner ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        isLoading={removingId === member.id}
                        disabled={removingId !== null}
                        onClick={() => void removeMemberRow(member.id)}
                      >
                        {m.sharedListRemoveButton()}
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {actionError && (
          <p className="text-destructive text-sm">
            {sharedListError(actionError)}
          </p>
        )}

        {selfMember && (
          <AlertDialog
            open={leaveOpen}
            onOpenChange={(details) => setLeaveOpen(details.open)}
          >
            <AlertDialogContent>
              <AlertDialogHeader
                title={m.sharedListLeaveConfirmTitle()}
                description={m.sharedListLeaveConfirmBody()}
              />
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => setLeaveOpen(false)}>
                  {m.cancel()}
                </Button>
                <Button
                  variant="destructive"
                  isLoading={removingId === selfMember.id}
                  disabled={removingId !== null}
                  onClick={() => {
                    setLeaveOpen(false)
                    void removeMemberRow(selfMember.id)
                  }}
                >
                  {m.sharedListLeaveButton()}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isOwner && (
          <form onSubmit={invite} className="flex items-end gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor="shared-list-invite">
                {m.sharedListInviteLabel()}
              </FieldLabel>
              <Input
                id="shared-list-invite"
                value={inviteName}
                placeholder={m.sharedListInvitePlaceholder()}
                disabled={inviteBusy}
                onChange={(event) => setInviteName(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              isLoading={inviteBusy}
              disabled={inviteBusy || !inviteName.trim()}
            >
              {m.sharedListInviteButton()}
            </Button>
          </form>
        )}
        {inviteError && (
          <p className="text-destructive text-sm">
            {sharedListError(inviteError)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
