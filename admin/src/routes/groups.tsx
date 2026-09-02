import { Button, Card, Table, Text, Title } from "@mantine/core"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { type AdminGroup, api, getToken } from "../lib/api"
import { useRequireAuth } from "../lib/auth"

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
})

function GroupsPage() {
  useRequireAuth()
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // The auth gate navigates away when the token is missing — skip the
    // doomed request (it would 401 and clear a token that isn't there).
    if (!getToken()) return
    try {
      setGroups(await api<AdminGroup[]>("/api/admin/groups"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const deleteGroup = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Delete group "${name}"? All of its data (categories, items, lists, history) is removed.`
      )
    ) {
      return
    }
    setError(null)
    try {
      await api(`/api/admin/groups/${id}`, { method: "DELETE" })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
      <Title order={2} mb="lg">
        Groups
      </Title>

      {error && (
        <Text c="red" mb="md">
          {error}
        </Text>
      )}

      <Card withBorder radius="md" padding={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Owner</Table.Th>
              <Table.Th>Members</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.map((group) => (
              <Table.Tr key={group.id}>
                <Table.Td>{group.name}</Table.Td>
                <Table.Td>{group.ownerUsername ?? group.owner}</Table.Td>
                <Table.Td>{group.membersCount}</Table.Td>
                <Table.Td>{group.created ?? "—"}</Table.Td>
                <Table.Td>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="red"
                    onClick={() => void deleteGroup(group.id, group.name)}
                  >
                    Delete
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </main>
  )
}
