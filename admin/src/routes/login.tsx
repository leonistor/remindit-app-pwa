import {
  Button,
  Card,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { AdminApiError, api, getToken, setToken } from "../lib/api"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Client-side only: the SSR pass can't see the localStorage token, so a
  // beforeLoad redirect here would run with the wrong answer on the server.
  useEffect(() => {
    if (getToken()) void navigate({ to: "/" })
  }, [navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const auth = await api<{
        token: string
        user: { role?: string }
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      // Role check happens client-side for UX; the real gate is server-side
      // on every /api/admin/* call (403 → session cleared by the client).
      if (auth.user.role !== "admin") {
        setError("This account does not have admin access.")
        return
      }
      setToken(auth.token)
      // Client-side navigation: a full reload would go through SSR, where
      // the (localStorage-only) token is invisible and the guards misfire.
      await navigate({ to: "/" })
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : "Sign-in failed — is the BFF running?"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "96px auto", padding: "0 24px" }}>
      <Card withBorder radius="md" padding="lg">
        <Title order={2} mb="md">
          RemindIt Admin
        </Title>
        <form onSubmit={submit}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordInput
              label="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Card>
    </main>
  )
}
