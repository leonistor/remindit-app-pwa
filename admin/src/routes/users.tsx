import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { type AdminUser, api, getToken, type UserRole } from "../lib/api"
import { useRequireAuth } from "../lib/auth"

export const Route = createFileRoute("/users")({
  component: UsersPage,
})

function UsersPage() {
  useRequireAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    role: "user" as UserRole,
  })

  const load = useCallback(async () => {
    // The auth gate navigates away when the token is missing — skip the
    // doomed request (it would 401 and clear a token that isn't there).
    if (!getToken()) return
    try {
      const page = await api<{ items: AdminUser[] }>("/api/admin/users")
      setUsers(page.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setCreating(false)
      setForm({ email: "", username: "", password: "", role: "user" })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const deleteUser = async (id: string, username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) {
      return
    }
    setError(null)
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Users</Title>
        <Button onClick={() => setCreating(true)}>Create user</Button>
      </Group>

      {error && (
        <Text c="red" mb="md">
          {error}
        </Text>
      )}

      <Card withBorder radius="md" padding={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Username</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.username}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Badge variant={user.role === "admin" ? "filled" : "light"}>
                    {user.role}
                  </Badge>
                </Table.Td>
                <Table.Td>{user.created ?? "—"}</Table.Td>
                <Table.Td>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="red"
                    onClick={() => void deleteUser(user.id, user.username)}
                  >
                    Delete
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={creating}
        onClose={() => setCreating(false)}
        title="Create user"
      >
        <form onSubmit={createUser}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
            <TextInput
              label="Username"
              required
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
            />
            <PasswordInput
              label="Password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <Select
              label="Role"
              data={["user", "admin"]}
              value={form.role}
              onChange={(value) =>
                setForm({ ...form, role: (value as UserRole) ?? "user" })
              }
            />
            <Button type="submit" loading={busy}>
              Create
            </Button>
          </Stack>
        </form>
      </Modal>
    </main>
  )
}
