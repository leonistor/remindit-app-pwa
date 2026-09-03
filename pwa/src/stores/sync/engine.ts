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
import { bffApi } from "@/lib/bff-api"
import { $catalog } from "../catalog"
import { $categories } from "../categories"
import { $history } from "../history"
import { $list } from "../list"
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
import { $syncSession, getSession, setSession } from "./session"

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

const pbBase = `${import.meta.env?.PUBLIC_BFF_URL ?? "http://127.0.0.1:3100"}/pb`
const pb = new PocketBase(pbBase)
pb.autoCancellation(false)

const COLLECTIONS: SyncCollection[] = [
  "categories",
  "items",
  "list_entries",
  "history_events",
]

let unsubscribeFns: Array<() => void> = []
let reconcileTimer: ReturnType<typeof setTimeout> | null = null
let applying = false
let profilePushTimer: ReturnType<typeof setTimeout> | null = null
let connectPromise: Promise<void> | null = null
let storeListenersWired = false
const lastSeenIds: Record<string, Set<string>> = {}

// --- helpers ----------------------------------------------------------------

const remoteList = async (
  collection: SyncCollection,
  groupId: string
): Promise<RemoteRecord[]> => {
  const result = await pb.collection(collection).getFullList({
    filter: pb.filter("group = {:groupId}", { groupId }),
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
}

const pbIdToLocal = (
  maps: Maps,
  collection: SyncCollection,
  pbId: unknown
): string | null => {
  if (typeof pbId !== "string") return null
  for (const [localId, mapped] of Object.entries(maps.map[collection])) {
    if (mapped === pbId) return localId
  }
  return null
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
        const remoteRecord = maps.remote[collection].find(
          (candidate) => candidate.localId === raw
        )
        if (!remoteRecord) return raw
        return pbIdToLocal(maps, collection, remoteRecord.id) ?? raw
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
  maps: Maps
): Promise<void> {
  const localRecords = spec.local()
  const remote = maps.remote[spec.collection]

  // Pre-diff snapshots for the persist check below: `maps` aliases the store
  // values, so a post-mutation self-compare could never detect diff-only
  // changes (heal stamps, prunes).
  const mapBefore = JSON.stringify(maps.map[spec.collection])
  const journalBefore = JSON.stringify(maps.journal[spec.collection])

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
  const collection = spec.collection

  for (const action of result.actions) {
    switch (action.kind) {
      case "remoteCreate": {
        const record = (await pb
          .collection(collection)
          .create(action.payload)) as unknown as RemoteRecord
        maps.map[collection][action.localId] = record.id
        maps.journal[collection][record.id] = record.updated ?? ""
        changed = true
        break
      }
      case "remotePatch": {
        const record = (await pb
          .collection(collection)
          .update(action.pbId, action.payload)) as unknown as RemoteRecord
        maps.journal[collection][record.id] = record.updated ?? ""
        changed = true
        break
      }
      case "remoteDelete": {
        await pb.collection(collection).delete(action.pbId)
        changed = true
        break
      }
      case "localApply": {
        const adopted = spec.adopt(action.remote, maps)
        if (adopted) spec.applyLocal(adopted)
        changed = true
        break
      }
      case "localAdopt": {
        const adopted = spec.adopt(action.remote, maps)
        if (adopted) {
          maps.map[collection][action.localId] = action.pbId
          spec.applyLocal(adopted)
          changed = true
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
    JSON.stringify(maps.map[collection]) !== mapBefore ||
    JSON.stringify(maps.journal[collection]) !== journalBefore
  ) {
    $syncMap.set({ ...$syncMap.get(), [collection]: maps.map[collection] })
    $syncJournal.set({
      ...$syncJournal.get(),
      [collection]: maps.journal[collection],
    })
    $syncTombstones.set({ ...$syncTombstones.get(), [collection]: [] })
  }
}

/** Runs a full reconcile pass. Exported for the engine tests; not in the public barrel. */
export async function reconcileAll(): Promise<void> {
  const session = getSession()
  const groupId = $syncGroup.get()
  if (!session || !groupId || applying) return

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
    }
    // Fetch all remote lists first: history adoption translates ids across
    // collections (items/categories).
    for (const collection of COLLECTIONS) {
      maps.remote[collection] = await remoteList(collection, groupId)
    }
    // Order matters: relations resolve against earlier collections.
    for (const spec of SPECS) {
      await reconcileCollection(spec, groupId, maps)
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

  try {
    const record = (await pb
      .collection("users")
      .getOne(session.userId)) as unknown as RemoteRecord
    const remoteUpdated = record.updated ?? ""
    const profileChanged =
      record.username !== profile.username ||
      record.firstName !== profile.firstName ||
      record.lastName !== profile.lastName ||
      (record.avatar ?? "") !== profile.avatar

    if (profileChanged) {
      const remoteWins =
        profileJournal === undefined || remoteUpdated > profileJournal
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
        await pb.collection("users").update(session.userId, {
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
  const tombstones = $syncTombstones.get()
  const forCollection = tombstones[collection as SyncCollection] ?? []
  const fresh = [...previous].filter((id) => !current.has(id))
  if (fresh.length > 0) {
    tombstones[collection as SyncCollection] = [...forCollection, ...fresh]
    $syncTombstones.set(tombstones)
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

// --- bootstrap / sign-in ----------------------------------------------------

async function ensureGroup(): Promise<string> {
  const session = getSession()
  if (!session) throw new Error("not signed in")
  const groups = await bffApi.listGroups(session.token)
  const stored = $syncGroup.get()
  const active = groups.find((g) => g.id === stored) ?? groups[0]
  if (active) {
    $syncGroup.set(active.id)
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
  setSyncState({ status: "connecting", lastError: null })
  try {
    // Validate the (possibly stale) token; a BffError bubbles to `error`.
    const me = await bffApi.me(session.token)
    setSession({ ...session, email: me.email })
    pb.authStore.save(session.token, {
      id: session.userId,
      email: me.email,
      collectionId: "_pb_users_auth_",
      collectionName: "users",
    } as never)

    const groupId = await ensureGroup()
    setSyncState({ status: "online", groupId })

    await reconcileAll()
    await subscribeRealtime(groupId)
    wireStoreListeners()
  } catch (error) {
    setSyncState({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

async function subscribeRealtime(groupId: string): Promise<void> {
  for (const unsubscribe of unsubscribeFns) unsubscribe()
  unsubscribeFns = []
  for (const collection of COLLECTIONS) {
    await pb.collection(collection).subscribe("*", () => scheduleReconcile(), {
      filter: pb.filter("group = {:groupId}", { groupId }),
    })
    unsubscribeFns.push(() => {
      pb.collection(collection).unsubscribe("*")
    })
  }
}

function wireStoreListeners(): void {
  // App-lifetime listeners: wired once, never unwired — re-connects must not
  // re-subscribe (the unsubscribe refs would be overwritten and the listeners
  // would stack). Without a session the callbacks no-op instead.
  if (storeListenersWired) return
  storeListenersWired = true
  const watch = (collection: SyncCollection, ids: () => string[]) => {
    // Snapshot-diff on every store change → tombstones for removed ids.
    ;(collection === "categories"
      ? $categories
      : collection === "items"
        ? $catalog
        : collection === "list_entries"
          ? $list
          : $history
    ).subscribe(() => {
      if (applying || !getSession()) return
      trackIds(collection, ids())
      scheduleReconcile()
    })
  }
  watch("categories", () => $categories.get().map((c) => c.id))
  watch("items", () => $catalog.get().map((i) => i.id))
  watch("list_entries", () => $list.get().map((e) => e.id))
  watch("history_events", () => $history.get().map((h) => h.id))

  // Profile pushes are LWW-debounced.
  $user.subscribe(() => {
    if (applying || !$syncSession.get()) return
    if (profilePushTimer) return
    profilePushTimer = setTimeout(() => {
      profilePushTimer = null
      void reconcileAll()
    }, 1000)
  })
}

// --- public API -------------------------------------------------------------

export async function signIn(email: string, password: string): Promise<void> {
  const auth = await bffApi.login(email, password)
  setSession({
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
  setSession({
    token: auth.token,
    userId: auth.user.id,
    email: auth.user.email,
  })
  await connect()
}

export async function signOut(): Promise<void> {
  for (const unsubscribe of unsubscribeFns) unsubscribe()
  unsubscribeFns = []
  setSession(null)
  $syncGroup.set("")
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
  pb.authStore.clear()
  setSyncState({ status: "off", groupId: null, lastError: null })
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
