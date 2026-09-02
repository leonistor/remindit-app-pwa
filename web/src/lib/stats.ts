// Live, aggregate-only platform stats from the BFF (phase 4: minimal BFF
// use). Server-side fetch — the BFF caches for 60s, so this is cheap per
// request; BFF-unreachable degrades to nulls (UI shows "—"), never a 500.

import { createServerFn } from "@tanstack/react-start"

export type PlatformStats = {
  users: number | null
  groups: number | null
}

export const getStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformStats> => {
    const base = process.env.PUBLIC_BFF_URL ?? "http://127.0.0.1:3100"
    try {
      const res = await fetch(`${base}/api/stats`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) return { users: null, groups: null }
      const data = (await res.json()) as { users: number; groups: number }
      return { users: data.users, groups: data.groups }
    } catch {
      return { users: null, groups: null }
    }
  },
)
