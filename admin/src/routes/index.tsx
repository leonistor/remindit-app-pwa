import { Badge, Card, SimpleGrid, Text, Title } from "@mantine/core"
import { createFileRoute } from "@tanstack/react-router"
import type { AdminOverview } from "../lib/api"
import { useRequireAuth } from "../lib/auth"
import { adminList, useAdminResource } from "../lib/use-admin-resource"

export const Route = createFileRoute("/")({
  component: OverviewPage,
})

function OverviewPage() {
  useRequireAuth()
  const { data, error } = useAdminResource<AdminOverview>(
    adminList("/api/admin/overview")
  )

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
