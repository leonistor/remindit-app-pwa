// Sync engine (phase 5, docs/SYNC.md): connects the local-first nanostores to
// the backend through the BFF auth RPC + the /pb/* data-plane forwarder.
//
// Design recap:
// - Journal + three-way reconciliation per collection (reconcile.ts holds the
//   pure diff; this module executes it against the PB SDK and the stores).
// - Local ids stay local; pb records carry `localId`; the device keeps a
//   localId → pbId map. Conflicts resolve last-write-wins by PB's server-side
//   `updated`.
// - Realtime subscriptions trigger debounced reconciles; self-echoes are
//   harmless because the reconcile is idempotent.
// - History is append-only (create-only sync).

import { atom } from "nanostores"
import PocketBase from "pocketbase"
import { bffApi, setRotatedTokenHandler, setUnauthorizedHandler } from "@/lib/bff-api"
import { env } from "@/lib/env"
import { NOT_SIGNED_IN } from "@/lib/sync-constants"
import { $catalog } from "../catalog"
import { $categories } from "../categories"
import { $history } from "../history"
import { $list } from "../list"
import { refreshNotifications } from "../notifications"
import { jsonStore, STORAGE_KEYS } from "../persistence"
import type {
  CatalogItem,
  Category,
  CategoryFrequency,
  HistoryEvent,
  ListEntry,
} from "../types"
import { UNCATEGORIZED_ID } from "../types"
import { $user } from "../user"
import {
  diffCollection,
  type RemoteRecord,
  type SyncCollection,
  type SyncJournal,
  type SyncMap,
} from "./reconcile"
import {
  $syncSession,
  getSession,
  patchSessionToken,
  setSession,
  type SyncSession,
} from "./session"

// --- state ------------------------------------------------------------------

export type SyncStatus = "off" | "connecting" | "online" | "error"

export type SyncState = {
  status: SyncStatus
  groupId: string | null
  lastError: string | null
}

export const $syncState = atom<SyncState>({
  status: "off",
  groupId: null,
  lastError: null,
})

const setSyncState = (patch: Partial<SyncState>): void => {
  $syncState.set({ ...$syncState.get(), ...patch })
}

// --- persisted sync state ---------------------------------------------------

const $syncGroup = jsonStore<string>(STORAGE_KEYS.syncGroup, "")
const $syncMap = jsonStore<Record<SyncCollection, SyncMap>>(
  STORAGE_KEYS.syncMap,
  { categories: {}, items: {}, list_entries: {}, history_events: {} }
)
const $syncJournal = jsonStore<Record<SyncCollection, SyncJournal>>(
  STORAGE_KEYS.syncJournal,
  { categories: {}, items: {}, list_entries: {}, history_events: {} }
)
const $syncTombstones = jsonStore<Record<SyncCollection, string[]>>(
  STORAGE_KEYS.syncTombstones,
  { categories: [], items: [], list_entries: [], history_events: [] }
)

// --- PB client (through the /pb/* forwarder — never direct, D2) -------------
//
// Constructed lazily, on first real use: importing this module must have zero
// side effects (the engine's contract in stores/index.ts), so `new
// PocketBase()` and the afterSend/token-rotation wiring run only once the sync
// engine is actually exercised (a connect/sign-in/capture path), never at
// import time. `pbBase` is a plain string — safe at module scope.

const pbBase = `${env.bffUrl}/pb`
let pb: PocketBase | null = null
let pbWired = false
const getPb = (): PocketBase => {
  if (!pb) {
    pb = new PocketBase(pbBase)
    pb.autoCancellation(false)
  }
  if (!pbWired) {
    pbWired = true
    pb.afterSend = (response, data) => {
      captureRotatedToken(response.headers.get("X-Session-Token"))
      return data
    }
    setRotatedTokenHandler(captureRotatedToken)
    // Unified client 401 policy (mirrors admin's clear-and-bounce): a 401 from
    // an account-level RPC means the session is dead — sign out so the user
    // gets a clean re-auth instead of a lingering broken state.
    setUnauthorizedHandler(() => {
      if (getSession()) void signOut()
    })
  }
  return pb
}

// --- token rotation capture -------------------------------------------------

/**
 * Patches the persisted session (and the SDK auth store) with a rotated token
 * delivered in the BFF's `X-Session-Token` response header: its auth
 * middleware auth-refreshes near-expiry tokens and rides the fresh one on
 * that same response — including /pb/* forwarder calls, so sessions outlive
 * the original login token's TTL. A quiet background patch: identity fields
 * stay, no sync status changes, no reconcile triggers; a missing or
 * already-current header value no-ops (rotation headers can ride concurrent
 * in-flight responses — the guard prevents patch loops). Exported for the
 * engine tests; not in the public barrel.
 */
export function captureRotatedToken(
  headerValue: string | null | undefined
): void {
  const session = getSession()
  if (!headerValue || !session || headerValue === session.token) return
  patchSessionToken(headerValue)
  // The data-plane client must carry the fresh token on subsequent calls —
  // same record shape the connect path seeds, so the authStore stays valid.
  getPb().authStore.save(headerValue, {
    id: session.userId,
    email: session.email,
    collectionId: "_pb_users_auth_",
    collectionName: "users",
  } as never)
}

const COLLECTIONS: SyncCollection[] = [
  "categories",
  "items",
  "list_entries",
  "history_events",
]

let unsubscribeFns: Array<() => void> = []
let reconcileTimer: ReturnType<typeof setTimeout> | null = null
let notificationRefreshTimer: ReturnType<typeof setTimeout> | null = null
let applying = false
let profilePushTimer: ReturnType<typeof setTimeout> | null = null
let connectPromise: Promise<void> | null = null
let storeListenersWired = false
let sessionGeneration = 0
const lastSeenIds: Record<string, Set<string>> = {}

// --- helpers ----------------------------------------------------------------

const remoteList = async (
  collection: SyncCollection,
  groupId: string
): Promise<RemoteRecord[]> => {
  const client = getPb()
  const result = await client.collection(collection).getFullList({
    filter: client.filter("group = {:groupId}", { groupId }),
    sort: "created",
  })
  return result as unknown as RemoteRecord[]
}

const isFrequency = (value: unknown): value is CategoryFrequency =>
  typeof value === "string" && value.length > 0

// --- collection specs -------------------------------------------------------

type CollectionSpec<L> = {
  collection: SyncCollection
  local: () => L[]
  createOnly?: boolean
  toPayload: (local: L, maps: Maps) => Record<string, unknown>
  matches: (local: L, remote: RemoteRecord, maps: Maps) => boolean
  applyLocal: (local: L) => void
  removeLocal: (localId: string) => void
  /** Return null to skip adoption (e.g. entry whose item is unknown yet). */
  adopt: (remote: RemoteRecord, maps: Maps) => L | null
}

type Maps = {
  map: Record<SyncCollection, SyncMap>
  journal: Record<SyncCollection, SyncJournal>
  remote: Record<SyncCollection, RemoteRecord[]>
  /** Precomputed pbId→localId per collection (rebuilt per reconcile pass). */
  reverseMaps: Record<SyncCollection, Map<string, string>>
  /** Precomputed localId→remoteRecord per collection (rebuilt per pass). */
  remoteByLocalId: Record<SyncCollection, Map<string, RemoteRecord>>
}

const pbIdToLocal = (
  maps: Maps,
  collection: SyncCollection,
  pbId: unknown
): string | null => {
  if (typeof pbId !== "string") return null
  return maps.reverseMaps[collection].get(pbId) ?? null
}

const colorOrNull = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined

const SPECS: CollectionSpec<
  Category | CatalogItem | ListEntry | HistoryEvent
>[] = [
  {
    collection: "categories",
    local: () => $categories.get(),
    toPayload: (c) => ({
      name: (c as Category).name,
      frequency: (c as Category).frequency,
      ...((c as Category).color !== undefined
        ? { color: (c as Category).color }
        : {}),
    }),
    matches: (c, r) => {
      const category = c as Category
      return (
        r.name === category.name &&
        r.frequency === category.frequency &&
        colorOrNull(r.color) === category.color
      )
    },
    applyLocal: (local) => {
      const category = local as Category
      $categories.set(
        $categories.get().some((c) => c.id === category.id)
          ? $categories.get().map((c) => (c.id === category.id ? category : c))
          : [...$categories.get(), category]
      )
    },
    removeLocal: (localId) => {
      $categories.set($categories.get().filter((c) => c.id !== localId))
    },
    adopt: (r) => ({
      id: (r.localId as string) ?? r.id,
      name: r.name as string,
      frequency: (isFrequency(r.frequency)
        ? r.frequency
        : "unknown") as CategoryFrequency,
      color: colorOrNull(r.color),
    }),
  },
  {
    collection: "items",
    local: () => $catalog.get(),
    toPayload: (i, maps) => ({
      name: (i as CatalogItem).name,
      // Local category id → pb record id (sentinel fallback keeps required
      // relations satisfiable even if a category sync is pending).
      category:
        maps.map.categories[(i as CatalogItem).categoryId] ??
        maps.map.categories[UNCATEGORIZED_ID],
    }),
    matches: (i, r, maps) => {
      const item = i as CatalogItem
      return (
        r.name === item.name &&
        r.category === maps.map.categories[item.categoryId]
      )
    },
    applyLocal: (local) => {
      const item = local as CatalogItem
      $catalog.set(
        $catalog.get().some((i) => i.id === item.id)
          ? $catalog.get().map((i) => (i.id === item.id ? item : i))
          : [...$catalog.get(), item]
      )
    },
    removeLocal: (localId) => {
      $catalog.set($catalog.get().filter((i) => i.id !== localId))
    },
    adopt: (r, maps) => {
      const categoryId =
        pbIdToLocal(maps, "categories", r.category) ?? UNCATEGORIZED_ID
      return {
        id: (r.localId as string) ?? r.id,
        name: r.name as string,
        categoryId,
      }
    },
  },
  {
    collection: "list_entries",
    local: () => $list.get(),
    toPayload: (e, maps) => ({
      item: maps.map.items[(e as ListEntry).itemId],
      checked: (e as ListEntry).checked,
      addedAt: (e as ListEntry).addedAt,
    }),
    matches: (e, r, maps) => {
      const entry = e as ListEntry
      return (
        r.item === maps.map.items[entry.itemId] &&
        r.checked === entry.checked &&
        Number(r.addedAt) === entry.addedAt
      )
    },
    applyLocal: (local) => {
      const entry = local as ListEntry
      $list.set(
        $list.get().some((e) => e.id === entry.id)
          ? $list.get().map((e) => (e.id === entry.id ? entry : e))
          : [...$list.get(), entry]
      )
    },
    removeLocal: (localId) => {
      $list.set($list.get().filter((e) => e.id !== localId))
    },
    adopt: (r, maps) => {
      const itemId = pbIdToLocal(maps, "items", r.item)
      // An entry whose item is unknown (cascade pending) is skipped — it
      // resolves on the next reconcile once the item lands.
      if (!itemId) return null
      return {
        id: (r.localId as string) ?? r.id,
        itemId,
        checked: Boolean(r.checked),
        addedAt: Number(r.addedAt ?? 0),
      }
    },
  },
  {
    collection: "history_events",
    local: () => $history.get(),
    createOnly: true,
    toPayload: (h) => ({
      action: (h as HistoryEvent).action,
      itemId: (h as HistoryEvent).itemId,
      itemName: (h as HistoryEvent).itemName,
      categoryId: (h as HistoryEvent).categoryId,
      categoryName: (h as HistoryEvent).categoryName,
      timestamp: (h as HistoryEvent).timestamp,
    }),
    matches: () => true, // create-only: existence is the only question
    applyLocal: (local) => {
      const event = local as HistoryEvent
      $history.set([...$history.get(), event])
    },
    removeLocal: () => {
      // create-only: never deletes
    },
    adopt: (r, maps) => {
      // itemId/categoryId are text snapshots from the ORIGIN device's local
      // ids — translate through the remote items/categories records
      // (remote record localId = origin's local id) when possible.
      const translate = (collection: SyncCollection, raw: unknown): string => {
        if (typeof raw !== "string") return ""
        const remoteRecord = maps.remoteByLocalId[collection].get(raw)
        if (!remoteRecord) return ""
        return pbIdToLocal(maps, collection, remoteRecord.id) ?? ""
      }
      return {
        id: (r.localId as string) ?? r.id,
        action: (r.action === "remove"
          ? "remove"
          : "add") as HistoryEvent["action"],
        itemId: translate("items", r.itemId),
        itemName: (r.itemName as string) ?? "",
        categoryId: translate("categories", r.categoryId),
        categoryName: (r.categoryName as string) ?? "",
        timestamp: Number(r.timestamp ?? 0),
      }
    },
  },
]

// --- reconcile --------------------------------------------------------------

async function reconcileCollection<L>(
  spec: CollectionSpec<L>,
  groupId: string,
  maps: Maps,
  reconcileSession: string
): Promise<boolean> {
  const localRecords = spec.local()
  const remote = maps.remote[spec.collection]

  // Pre-diff snapshots for the persist check below: `maps` aliases the store
  // values, so a post-mutation self-compare could never detect diff-only
  // changes (heal stamps, prunes).
  const mapBefore = JSON.stringify(maps.map[spec.collection])
  const journalBefore = JSON.stringify(maps.journal[spec.collection])
  // The diff consumes every pending tombstone (its result array is always
  // empty), so a pass with pending tombstones must persist even when the
  // heal-on-change rule no longer forces `changed` on unchanged records.
  const tombstonesPending =
    ($syncTombstones.get()[spec.collection] ?? []).length > 0

  const result = diffCollection({
    local: localRecords,
    remote,
    map: maps.map[spec.collection],
    journal: maps.journal[spec.collection],
    tombstones: $syncTombstones.get()[spec.collection] ?? [],
    toPayload: (local) => ({
      ...spec.toPayload(local, maps),
      localId: (local as { id: string }).id,
      group: groupId,
    }),
    matches: (local, remote) => spec.matches(local, remote, maps),
    createOnly: spec.createOnly,
  })

  // Merge the diff's mutated map/journal copies back BEFORE executing: the
  // journal stamping (heal + remote-win localApply), map recovery and
  // vanished-record pruning all live in these copies. Dropping them re-runs
  // stale LWW decisions (a local edit right after a remote-win apply would be
  // judged against an old journal and silently discarded) and re-emits no-op
  // actions on every reconcile.
  maps.map[spec.collection] = result.map
  maps.journal[spec.collection] = result.journal

  let changed = false
  let adopted = false
  const collection = spec.collection
  const client = getPb()

  for (const action of result.actions) {
    // Cancel an in-flight pass when the session or group is torn down under
    // it (sign-out / wipe / switch landing while an earlier action was
    // awaiting): stop executing writes against the stale group. The
    // `applying` flag prevents stacking but cannot interrupt a running pass —
    // this guard stops it at the next action boundary.
    if (!getSession() || $syncGroup.get() !== reconcileSession) return false
    switch (action.kind) {
      case "remoteCreate": {
        const record = (await client
          .collection(collection)
          .create(action.payload)) as unknown as RemoteRecord
        maps.map[collection][action.localId] = record.id
        maps.reverseMaps[collection].set(record.id, action.localId)
        maps.journal[collection][record.id] = record.updated ?? ""
        changed = true
        break
      }
      case "remotePatch": {
        const record = (await client
          .collection(collection)
          .update(action.pbId, action.payload)) as unknown as RemoteRecord
        maps.journal[collection][record.id] = record.updated ?? ""
        changed = true
        break
      }
      case "remoteDelete": {
        await client.collection(collection).delete(action.pbId)
        changed = true
        break
      }
      case "localApply": {
        const local = spec.adopt(action.remote, maps)
        if (local) spec.applyLocal(local)
        changed = true
        break
      }
      case "localAdopt": {
        const local = spec.adopt(action.remote, maps)
        if (local) {
          maps.map[collection][action.localId] = action.pbId
          maps.reverseMaps[collection].set(action.pbId, action.localId)
          spec.applyLocal(local)
          changed = true
          adopted = true
        }
        break
      }
      case "localDelete": {
        spec.removeLocal(action.localId)
        changed = true
        break
      }
      case "heal":
        changed = true
        break
    }
  }

  // Persist the (possibly mutated) map/journal; tombstones are consumed.
  if (
    changed ||
    tombstonesPending ||
    JSON.stringify(maps.map[collection]) !== mapBefore ||
    JSON.stringify(maps.journal[collection]) !== journalBefore
  ) {
    // If the group changed during reconcile (switchGroup/signOut), skip
    // persisting stale data from the old group.
    if ($syncGroup.get() !== reconcileSession) return
    // Only persist the map when adoption succeeded or non-adopt map changes
    // occurred — prevents stamping dangling entries when adopt fails.
    if (adopted || JSON.stringify(maps.map[collection]) !== mapBefore) {
      $syncMap.set({ ...$syncMap.get(), [collection]: maps.map[collection] })
    }
    $syncJournal.set({
      ...$syncJournal.get(),
      [collection]: maps.journal[collection],
    })
    $syncTombstones.set({ ...$syncTombstones.get(), [collection]: [] })
  }
  return true
}

/** Runs a full reconcile pass. Exported for the engine tests; not in the public barrel. */
export async function reconcileAll(): Promise<void> {
  const session = getSession()
  const groupId = $syncGroup.get()
  if (!session || !groupId || applying) return
  const reconcileSession = $syncGroup.get()

  applying = true
  try {
    const maps: Maps = {
      map: $syncMap.get(),
      journal: $syncJournal.get(),
      remote: {
        categories: [],
        items: [],
        list_entries: [],
        history_events: [],
      },
      reverseMaps: {
        categories: new Map(),
        items: new Map(),
        list_entries: new Map(),
        history_events: new Map(),
      },
      remoteByLocalId: {
        categories: new Map(),
        items: new Map(),
        list_entries: new Map(),
        history_events: new Map(),
      },
    }
    // Fetch all remote lists first: history adoption translates ids across
    // collections (items/categories).
    for (const collection of COLLECTIONS) {
      maps.remote[collection] = await remoteList(collection, groupId)
    }
    // Prebuild reverse lookup maps for O(1) pbIdToLocal and translate lookups.
    for (const collection of COLLECTIONS) {
      for (const [localId, pbId] of Object.entries(maps.map[collection])) {
        maps.reverseMaps[collection].set(pbId, localId)
      }
      for (const record of maps.remote[collection]) {
        if (typeof record.localId === "string") {
          maps.remoteByLocalId[collection].set(record.localId, record)
        }
      }
    }
    // Order matters: relations resolve against earlier collections. A
    // cancelled pass (session/group torn down mid-pass) aborts the whole
    // reconcile — the maps are stale and "online" would describe the old
    // group, so skip the profile push and status flip entirely.
    for (const spec of SPECS) {
      const continued = await reconcileCollection(
        spec,
        groupId,
        maps,
        reconcileSession
      )
      if (!continued) return
    }
    await syncProfile()
    setSyncState({ status: "online", lastError: null })
  } catch (error) {
    setSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  } finally {
    applying = false
  }
}

// --- profile sync -----------------------------------------------------------

const profileJournalKey = "profile"

async function syncProfile(): Promise<void> {
  const session = getSession()
  if (!session) return
  const journal = $syncJournal.get()
  const profileJournal = (journal as unknown as Record<string, string>)[
    profileJournalKey
  ]
  const profile = $user.get()
  const client = getPb()

  try {
    const record = (await client
      .collection("users")
      .getOne(session.userId)) as unknown as RemoteRecord
    const remoteUpdated = record.updated ?? ""
    const profileChanged =
      record.username !== profile.username ||
      record.firstName !== profile.firstName ||
      record.lastName !== profile.lastName ||
      (record.avatar ?? "") !== profile.avatar

    if (profileChanged) {
      const remoteTs = Date.parse(remoteUpdated)
      const profileTs = Date.parse(profileJournal ?? "")
      const remoteWins =
        profileJournal === undefined ||
        Number.isNaN(remoteTs) ||
        remoteTs > profileTs
      if (remoteWins) {
        // Remote wins → overwrite the local profile.
        $user.set({
          ...profile,
          username: (record.username as string) ?? profile.username,
          firstName: (record.firstName as string) ?? "",
          lastName: (record.lastName as string) ?? "",
          avatar: (record.avatar as string) ?? "",
        })
      } else {
        // Local wins → push the profile up.
        await client.collection("users").update(session.userId, {
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatar: profile.avatar,
        })
      }
    }
    const nextJournal = { ...journal, [profileJournalKey]: remoteUpdated }
    $syncJournal.set(nextJournal as never)
  } catch {
    // Profile sync is best-effort; the data-plane reconcile continues.
  }
}

// --- store subscriptions (tombstone detection) ------------------------------

const trackIds = (collection: string, ids: string[]): void => {
  const previous = lastSeenIds[collection]
  if (!previous) {
    lastSeenIds[collection] = new Set(ids)
    return
  }
  const current = new Set(ids)
  const fresh = [...previous].filter((id) => !current.has(id))
  if (fresh.length > 0) {
    // Copy-on-write: spread into a new object before mutating so nanostores'
    // Object.is comparison detects the change.
    const prev = $syncTombstones.get()
    const updated = { ...prev }
    updated[collection as SyncCollection] = [
      ...(prev[collection as SyncCollection] ?? []),
      ...fresh,
    ]
    $syncTombstones.set(updated)
  }
  lastSeenIds[collection] = current
}

const scheduleReconcile = (): void => {
  if (reconcileTimer) return
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null
    void reconcileAll()
  }, 500)
}

// Notifications (D4): realtime bursts (invite + membership changes landing
// together) collapse into one refresh — same debounce style as
// scheduleReconcile, with a 1s window since the feed is non-urgent.
const scheduleNotificationRefresh = (): void => {
  if (notificationRefreshTimer) return
  notificationRefreshTimer = setTimeout(() => {
    notificationRefreshTimer = null
    void refreshNotifications()
  }, 1000)
}

// --- bootstrap / sign-in ----------------------------------------------------

async function ensureGroup(): Promise<string> {
  const session = getSession()
  if (!session) throw new Error(NOT_SIGNED_IN)
  const groups = await bffApi.listGroups(session.token)
  const stored = $syncGroup.get()
  const active = groups.find((g) => g.id === stored) ?? groups[0]
  if (active) {
    // When the stored group vanished (kicked / deleted), clear stale sync
    // buffers so the vanish sweep doesn't delete the new group's records.
    if (stored && active.id !== stored) {
      clearSyncBuffers()
    }
    // CAS: a concurrent switchGroup may have repointed $syncGroup while we
    // were awaiting listGroups. Never clobber its choice — runConnect reads
    // $syncGroup again and connects for the CURRENT group, so a stale
    // ensureGroup writing over the switch's pick would mis-point the whole
    // connect (subscribe the old group, leave the new one blind to realtime).
    if ($syncGroup.get() === stored) $syncGroup.set(active.id)
    return active.id
  }
  // First sign-in without any group: create one; the local data becomes its
  // seed (the first reconcile pushes it).
  const created = await bffApi.createGroup(session.token, "My list")
  $syncGroup.set(created.id)
  return created.id
}

// Serialized: a concurrent connect (e.g. an `online` event racing sign-in)
// reuses the in-flight connect instead of duplicating its work — duplicate
// "My list" group creation, stacked realtime subscriptions. `runConnect`
// never rejects (errors land in sync state), so the shared promise is safe.
function connect(): Promise<void> {
  connectPromise ??= runConnect().finally(() => {
    connectPromise = null
  })
  return connectPromise
}

async function runConnect(): Promise<void> {
  const session = getSession()
  if (!session) return
  const gen = sessionGeneration
  setSyncState({ status: "connecting", lastError: null })
  try {
    // Validate the (possibly stale) token; a BffError bubbles to `error`.
    const me = await bffApi.me(session.token)
    if (sessionGeneration !== gen) return
    setSession({ ...session, email: me.email })
    getPb().authStore.save(session.token, {
      id: session.userId,
      email: me.email,
      collectionId: "_pb_users_auth_",
      collectionName: "users",
    } as never)

    await ensureGroup()
    // A concurrent switchGroup may have repointed $syncGroup while we were
    // awaiting ensureGroup (whose CAS guard kept its pick); a sign-out/wipe
    // clears the session. Bail on a dead session; otherwise connect for the
    // CURRENT group — the switch awaits this same connect promise, so it
    // needs the reconcile + realtime for its group, not the group ensureGroup
    // resolved for (which would leave the new group blind until the next
    // scheduled reconnect).
    const currentGroup = $syncGroup.get()
    if (!getSession() || !currentGroup) return
    setSyncState({ status: "online", groupId: currentGroup })

    await reconcileAll()
    // The session may have died or another switch landed mid-reconcile —
    // don't wire realtime for a torn-down/old group.
    if (!getSession() || $syncGroup.get() !== currentGroup) return
    await subscribeRealtime(currentGroup)
    await subscribeNotifications()
    // Notifications (D4): one refresh per successful connect (sign-in /
    // foreground reconnect) — this plus the realtime subscription covers
    // docs/SYNC.md's "listed on sign-in + poll on reconcile" plan without a
    // poll per reconcile. Non-fatal: errors are swallowed in the store.
    void refreshNotifications()
    wireStoreListeners()
  } catch (error) {
    setSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

async function subscribeRealtime(groupId: string): Promise<void> {
  const client = getPb()
  for (const unsubscribe of unsubscribeFns) unsubscribe()
  unsubscribeFns = []
  for (const collection of COLLECTIONS) {
    await client.collection(collection).subscribe("*", () => scheduleReconcile(), {
      filter: client.filter("group = {:groupId}", { groupId }),
    })
    unsubscribeFns.push(() => {
      client.collection(collection).unsubscribe("*")
    })
  }
}

/**
 * Notifications subscription (D4): user-scoped, not group-scoped like the
 * data plane — the `notifications` rows carry `user`, so the filter keys on
 * the session's user id and the subscription survives group switches (it is
 * torn down and re-subscribed with everything else on reconnect, which is
 * harmless). The unsubscribe rides `unsubscribeFns`, so the signOut /
 * switchGroup teardown stays automatic. Not in COLLECTIONS/SPECS: this is
 * not a synced collection. A failed subscribe must not fail the connect —
 * notifications are best-effort (the connect-time refresh still lists what
 * is there).
 */
async function subscribeNotifications(): Promise<void> {
  const session = getSession()
  if (!session) return
  const client = getPb()
  try {
    await client
      .collection("notifications")
      .subscribe("*", () => scheduleNotificationRefresh(), {
        filter: client.filter("user = {:userId}", { userId: session.userId }),
      })
    unsubscribeFns.push(() => {
      client.collection("notifications").unsubscribe("*")
    })
  } catch {
    // Non-fatal: the data plane connects regardless.
  }
}

function wireStoreListeners(): void {
  // App-lifetime listeners: wired once, never unwired — re-connects must not
  // re-subscribe (the unsubscribe refs would be overwritten and the listeners
  // would stack). Without a session the callbacks no-op instead.
  if (storeListenersWired) return
  storeListenersWired = true
  // history_events is deliberately not watched: it is append-only
  // (create-only sync — its tombstones are meaningless, the diff never emits
  // them) and remote history already arrives via the realtime subscription.
  // Local history pushes still reconcile through the foreground/heartbeat
  // triggers, so nothing is lost — only per-keystroke-level churn avoided.
  const watch = (
    collection: "categories" | "items" | "list_entries",
    ids: () => string[]
  ) => {
    // Snapshot-diff on every store change → tombstones for removed ids.
    ;(collection === "categories"
      ? $categories
      : collection === "items"
        ? $catalog
        : $list
    ).subscribe(() => {
      if (applying || !getSession()) return
      trackIds(collection, ids())
      scheduleReconcile()
    })
  }
  watch("categories", () => $categories.get().map((c) => c.id))
  watch("items", () => $catalog.get().map((i) => i.id))
  watch("list_entries", () => $list.get().map((e) => e.id))

  // Profile pushes are LWW-debounced.
  // The `applying` guard is deliberately omitted here: the timer fires
  // unconditionally after 1 s, and reconcileAll() returns early if it is
  // already applying — so the push is never lost even when the user edits
  // during an in-flight reconcile.
  $user.subscribe(() => {
    if (!$syncSession.get()) return
    if (profilePushTimer) return
    profilePushTimer = setTimeout(() => {
      profilePushTimer = null
      void reconcileAll()
    }, 1000)
  })
}

// --- public API -------------------------------------------------------------

/**
 * Seed a new session and bump the connect generation only when the session
 * identity actually changes. Two concurrent sign-ins with the same account
 * (e.g. a sign-in racing an `online` reconnect) set the identical session —
 * bumping unconditionally would abort the first sign-in's in-flight connect
 * (the T0-3 generation guard) and, because `connect()` shares that aborted
 * promise, leave nothing to complete it. A genuinely different token or user
 * still bumps, so a stale connect never applies another account's state.
 */
const applySession = (session: SyncSession): void => {
  const prev = getSession()
  const changed =
    prev?.token !== session.token || prev?.userId !== session.userId
  setSession(session)
  if (changed) sessionGeneration++
}

export async function signIn(email: string, password: string): Promise<void> {
  const auth = await bffApi.login(email, password)
  applySession({
    token: auth.token,
    userId: auth.user.id,
    email: auth.user.email,
  })
  await connect()
}

export async function signUp(body: {
  email: string
  password: string
  username: string
}): Promise<void> {
  // The profile is seeded from the current local user (name/avatar), so the
  // first reconcile pushes the locally-generated identity up.
  const auth = await bffApi.register({
    email: body.email,
    password: body.password,
    passwordConfirm: body.password,
    username: body.username,
    firstName: $user.get().firstName,
    lastName: $user.get().lastName,
  })
  applySession({
    token: auth.token,
    userId: auth.user.id,
    email: auth.user.email,
  })
  await connect()
}

/**
 * Empties the group-scoped sync buffers (map/journal/tombstones) and the
 * in-memory lastSeenIds snapshots. Shared by signOut (full teardown) and
 * switchGroup (group-scoped teardown keeping session + local data): stale
 * buffers from the previous group would mis-judge the next group's records —
 * a stale journal entry judges a still-remote record as "locally deleted",
 * stale lastSeenIds manufacture false tombstones on the first store change.
 */
function clearSyncBuffers(): void {
  $syncMap.set({
    categories: {},
    items: {},
    list_entries: {},
    history_events: {},
  })
  $syncJournal.set({
    categories: {},
    items: {},
    list_entries: {},
    history_events: {},
  })
  $syncTombstones.set({
    categories: [],
    items: [],
    list_entries: [],
    history_events: [],
  })
  // Fresh id snapshots for the next session/group: a stale `lastSeenIds` set
  // from the previous one would turn the first store change into false
  // tombstones (its ids no longer exist locally).
  for (const key of Object.keys(lastSeenIds)) delete lastSeenIds[key]
}

export async function signOut(): Promise<void> {
  for (const unsubscribe of unsubscribeFns) unsubscribe()
  unsubscribeFns = []
  setSession(null)
  sessionGeneration++
  $syncGroup.set("")
  clearSyncBuffers()
  getPb().authStore.clear()
  setSyncState({ status: "off", groupId: null, lastError: null })
}

/**
 * Switch the active group: tear down sync state (NOT the session, NOT local
 * data), repoint $syncGroup, reconnect — the next reconcile merges local data
 * into the selected group and adopts its remote records (docs/SYNC.md "group
 * switch" trigger, merge semantics). Rejects before any teardown when there
 * is no session or the group is not among the caller's groups — state stays
 * fully intact on rejection. Like connect, the tail serializes on
 * `connectPromise` (H3): a concurrent in-flight connect is reused, never
 * duplicated.
 */
export async function switchGroup(groupId: string): Promise<void> {
  const session = getSession()
  if (!session) throw new Error(NOT_SIGNED_IN)
  const groups = await bffApi.listGroups(session.token)
  if (!groups.some((group) => group.id === groupId)) {
    throw new Error("group not found")
  }
  // Unsubscribe the old group's realtime first: once $syncGroup is repointed,
  // stale events for the previous group would schedule reconciles keyed to
  // the new active group. connect() re-subscribes for the new group.
  for (const unsubscribe of unsubscribeFns) unsubscribe()
  unsubscribeFns = []
  $syncGroup.set(groupId)
  clearSyncBuffers()
  setSyncState({ groupId, status: "connecting", lastError: null })
  await connect()
}

/**
 * After a leave/remove: if the stored active group is no longer in the
 * caller's groups, re-point to the first remaining group (or create "My
 * list") via switchGroup. No-op when the current group is still valid. The
 * just-created group passes switchGroup's membership check because the BFF
 * creates the owner membership row inside the same createGroup request.
 */
export async function recoverActiveGroup(): Promise<void> {
  const session = getSession()
  if (!session) return
  const groups = await bffApi.listGroups(session.token)
  if (groups.some((group) => group.id === $syncGroup.get())) return
  const next = groups[0]?.id ?? (await bffApi.createGroup(session.token, "My list")).id
  await switchGroup(next)
}

/** Called once from the app bootstrap (after initStores). */
export function initSync(): void {
  if (getSession()) void connect()
  // Reconnect when the browser comes back online after an outage.
  globalThis.addEventListener?.("online", () => {
    if (getSession() && $syncState.get().status !== "online") void connect()
  })
  // Foreground + heartbeat triggers (docs/SYNC.md): app-lifetime listeners —
  // signed out, both are gated no-ops, so unlike the realtime subscriptions
  // there is nothing to tear down on sign-out.
  globalThis.addEventListener?.("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      getSession() &&
      navigator.onLine
    ) {
      scheduleReconcile()
    }
  })
  setInterval(() => {
    if (getSession() && navigator.onLine) scheduleReconcile()
  }, 60_000)
}
