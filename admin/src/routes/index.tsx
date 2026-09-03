import { Badge, Card, SimpleGrid, Text, Title } from "@mantine/core"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { type AdminOverview, api, getToken } from "../lib/api"
import { useRequireAuth } from "../lib/auth"

export const Route = createFileRoute("/")({
  component: OverviewPage,
})

function OverviewPage() {
  useRequireAuth()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Client-side fetch: the SSR pass has no Bearer token, so the overview
  // counts load after mount — same pattern as the users/groups dashboards.
  const load = useCallback(async () => {
    // The auth gate navigates away when the token is missing — skip the
    // doomed request (it would 401 and clear a token that isn't there).
    if (!getToken()) return
    setError(null)
    try {
      setData(await api<AdminOverview>("/api/admin/overview"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <main style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
        <Text c="red">{error}</Text>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
        <Text c="dimmed">Loading…</Text>
      </main>
    )
  }

  const cards: Array<[string, number | string]> = [
    ["Users", data.users],
    ["Groups", data.groups],
    ["Catalog items", data.items],
    ["List entries", data.listEntries],
    ["History events", data.historyEvents],
  ]

  return (
    <main style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
      <Title order={2} mb="lg">
        Overview
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {cards.map(([label, value]) => (
          <Card key={label} withBorder radius="md" padding="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {label}
            </Text>
            <Text size="32px" fw={700}>
              {value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      <Badge variant="light" mt="lg">
        live counts from the BFF (superuser-side)
      </Badge>
    </main>
  )
}
