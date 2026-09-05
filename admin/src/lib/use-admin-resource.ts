// Shared data-fetch hook for admin list routes (item 8): each dashboard
// (overview, users, groups) repeats the same client-side fetch shape — token
// gate, data state, error state, mount load. This hook is the single copy of
// that pattern. Client-side only (the SSR pass has no Bearer token), mirroring
// the route usage in the users/groups pages.

import { useCallback, useEffect, useState } from "react"
import { api, getToken } from "./api"

export type AdminResourceState<T> = {
  data: T | null
  error: string | null
  /** Re-run the fetch (mutation pages call this after a create/delete). */
  load: () => Promise<void>
  /** Surface a mutation error in the same error slot as load failures. */
  setError: (message: string | null) => void
}

/**
 * Load a client-side admin resource. `fetcher` is invoked on mount and on
 * every `load()` call; it must be referentially stable (pass `adminList(path)`
 * or a `useCallback`-wrapped fetcher) so the mount effect doesn't loop.
 */
export function useAdminResource<T>(
  fetcher: () => Promise<T>
): AdminResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // The auth gate navigates away when the token is missing — skip the
    // doomed request (it would 401 and clear a token that isn't there).
    if (!getToken()) return
    setError(null)
    try {
      setData(await fetcher())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [fetcher])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, load, setError }
}

/**
 * Fetcher factory for list endpoints: `useAdminResource(adminList<T>(path))`.
 * Referentially stable (path is a constant), so it composes cleanly with the
 * hook.
 */
export const adminList = <T,>(path: string): (() => Promise<T>) => () =>
  api<T>(path)