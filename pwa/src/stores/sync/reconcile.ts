// Pure reconciliation diff for one sync collection (docs/SYNC.md): given the
// local records, the remote PB records, the device's sync map (localId →
// pbId), the journal (pbId → remote `updated` at last sync) and local-delete
// tombstones, produces the action list that reconciles both sides.
//
// Network-free by design — `tests/sync/reconcile.test.ts` pins the behavior;
// the engine (engine.ts) only executes the actions against the PB SDK and
// the local stores.

export type RemoteRecord = {
  id: string
  localId?: string
  updated?: string
  [key: string]: unknown
}

export type SyncCollection =
  | "categories"
  | "items"
  | "list_entries"
  | "history_events"

// localId → pbId for one collection
export type SyncMap = Record<string, string>
// pbId → remote `updated` at the last successful sync
export type SyncJournal = Record<string, string>

export type SyncAction =
  /** local-only record → create the pb record (with localId) */
  | { kind: "remoteCreate"; localId: string; payload: Record<string, unknown> }
  /** content differs, local wins → patch the pb record */
  | {
      kind: "remotePatch"
      pbId: string
      localId: string
      payload: Record<string, unknown>
    }
  /** content differs, remote wins (LWW) → overwrite the local record */
  | { kind: "localApply"; pbId: string; localId: string; remote: RemoteRecord }
  /** remote-only record (other device) → materialize locally */
  | { kind: "localAdopt"; pbId: string; localId: string; remote: RemoteRecord }
  /** tombstoned locally, still remote → delete the pb record */
  | { kind: "remoteDelete"; pbId: string; localId: string }
  /** pb record vanished (deleted elsewhere) → delete the local record */
  | { kind: "localDelete"; pbId: string; localId: string }
  /** content equal → journal heal only (no-op everywhere) */
  | { kind: "heal"; pbId: string; updated: string }

export type DiffSpec<L> = {
  local: L[]
  remote: RemoteRecord[]
  /** localId → pbId (mutated copy is returned) */
  map: SyncMap
  /** pbId → remote updated at last sync (mutated copy is returned) */
  journal: SyncJournal
  /** local ids deleted since the last sync */
  tombstones: string[]
  /** wire payload for a local record (group + localId added by the engine) */
  toPayload: (local: L) => Record<string, unknown>
  /** content equality between a local record and a remote record */
  matches: (local: L, remote: RemoteRecord) => boolean
  /** append-only collections (history): no patches, no deletes */
  createOnly?: boolean
}

export type DiffResult = {
  actions: SyncAction[]
  map: SyncMap
  journal: SyncJournal
  tombstones: string[]
}

const localIdOf = (remote: RemoteRecord): string =>
  (remote.localId as string | undefined) ?? remote.id

export function diffCollection<L>(spec: DiffSpec<L>): DiffResult {
  const map = { ...spec.map }
  const journal = { ...spec.journal }
  const nextTombstones: string[] = []
  const actions: SyncAction[] = []

  const remoteByPbId = new Map(spec.remote.map((r) => [r.id, r]))
  const remoteByLocalId = new Map(spec.remote.map((r) => [localIdOf(r), r]))
  const localById = new Map(
    spec.local.map((l) => [(l as { id: string }).id, l])
  )
  const reverseMap = new Map(Object.entries(map).map(([k, v]) => [v, k]))

  // 0. Vanished pb records (deleted elsewhere) → local deletes. Runs first so
  // the push loop below doesn't re-create records that are being removed.
  // Tombstoned localIds are skipped (the tombstone sweep owns their cleanup —
  // the local copy is already gone).
  const vanishedLocalIds = new Set<string>()
  if (!spec.createOnly) {
    const remotePbIds = new Set(spec.remote.map((r) => r.id))
    for (const [pbId, _updated] of Object.entries(journal)) {
      if (remotePbIds.has(pbId)) continue
      const localId = reverseMap.get(pbId) ?? pbId
      delete journal[pbId]
      for (const [key, value] of Object.entries(map)) {
        if (value === pbId) delete map[key]
      }
      if (spec.tombstones.includes(localId)) continue
      vanishedLocalIds.add(localId)
      actions.push({ kind: "localDelete", pbId, localId })
    }
  }

  // 1. Local records: push or lose (LWW).
  for (const local of spec.local) {
    const localId = (local as { id: string }).id
    if (vanishedLocalIds.has(localId)) continue
    // Recovery: map missing but a remote record carries our localId.
    let pbId = map[localId]
    let remote = pbId ? remoteByPbId.get(pbId) : undefined
    if (!remote) {
      const byLocalId = remoteByLocalId.get(localId)
      if (byLocalId && !map[localId]) {
        pbId = byLocalId.id
        map[localId] = pbId
        remote = byLocalId
      }
    }

    if (remote) {
      const updated = remote.updated ?? ""
      if (spec.createOnly) {
        // History is append-only: nothing to push once it exists remotely.
        journal[remote.id] = updated
        actions.push({ kind: "heal", pbId: remote.id, updated })
        continue
      }
      if (spec.matches(local, remote)) {
        journal[remote.id] = updated
        actions.push({ kind: "heal", pbId: remote.id, updated })
        continue
      }
      const journaled = journal[remote.id]
      const remoteChanged =
        journaled === undefined || updated > (journaled ?? "")
      if (remoteChanged) {
        actions.push({
          kind: "localApply",
          pbId: remote.id,
          localId,
          remote,
        })
        journal[remote.id] = updated
      } else {
        // Local wins. The journal is NOT advanced here — the engine stamps it
        // from the patch response's server-side `updated`.
        actions.push({
          kind: "remotePatch",
          pbId: remote.id,
          localId,
          payload: spec.toPayload(local),
        })
      }
      continue
    }

    if (spec.tombstones.includes(localId)) {
      // Locally deleted and already gone remotely — drop the tombstone.
      continue
    }
    actions.push({
      kind: "remoteCreate",
      localId,
      payload: spec.toPayload(local),
    })
  }

  // 2. Remote-only records: adopt (materialize locally). Non-destructive by
  // design — a record in the journal whose local copy vanished without a
  // tombstone (e.g. cleared storage) is restored, not treated as a delete.
  // Legitimate local deletes always leave tombstones (snapshot diff), and
  // tombstoned ids are never re-adopted.
  for (const remote of spec.remote) {
    const localId = localIdOf(remote)
    if (localById.has(localId) || spec.tombstones.includes(localId)) continue
    map[localId] = remote.id
    journal[remote.id] = remote.updated ?? ""
    actions.push({
      kind: "localAdopt",
      pbId: remote.id,
      localId,
      remote,
    })
  }

  if (spec.createOnly) {
    // History never deletes: tombstones are meaningless, journal only tracks
    // what we have seen for dedupe.
    return { actions, map, journal, tombstones: [] }
  }

  // 3. Tombstones → remote deletes (or expiry: prune map + journal so the
  // vanished-record sweep below doesn't misfire on already-gone records).
  for (const localId of spec.tombstones) {
    const pbId = map[localId]
    if (pbId && remoteByPbId.has(pbId)) {
      actions.push({ kind: "remoteDelete", pbId, localId })
    }
    delete map[localId]
    if (pbId) delete journal[pbId]
  }

  // 4. (Vanished pb records were handled by the step-0 sweep — the journal is
  // already pruned, so nothing left to do here.)

  return { actions, map, journal, tombstones: nextTombstones }
}
