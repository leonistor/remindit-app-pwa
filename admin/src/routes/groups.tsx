import { Button, Card, Table, Text, Title } from "@mantine/core"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { type AdminGroup, api } from "../lib/api"
import { useRequireAuth } from "../lib/auth"
import { adminList, useAdminResource } from "../lib/use-admin-resource"

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
})

function GroupsPage() {
  useRequireAuth()
  const {
    data: groups,
    error,
    load,
    setError,
  } = useAdminResource<AdminGroup[]>(adminList("/api/admin/groups"))
  // In-flight delete row: guards the Delete buttons against double-clicks
  // (a duplicate DELETE 404s into a spurious error message once the group is
  // already gone).
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteGroup = async (id: string, name: string) => {
    // Guard before the sync confirm() too: a second invocation must not reach
    // the dialog (or queue a second DELETE) while one is already in flight.
    if (deletingId !== null) return
    if (
      !window.confirm(
        `Delete group "${name}"? All of its data (categories, items, lists, history) is removed.`
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      await api(`/api/admin/groups/${id}`, { method: "DELETE" })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDeletingId(null)
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
            {groups?.map((group) => (
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
                    loading={deletingId === group.id}
                    disabled={deletingId !== null}
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
