import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { getToken } from "./api"

// Client-side auth gate. Bearer tokens live in localStorage, which the SSR
// pass cannot see — so route guards must run after mount in an effect, not
// in `beforeLoad` (that executes on the server during SSR, where the token
// is always absent, bouncing every hard navigation to /login and leaving the
// hydrated router stuck there). The first server and client renders agree
// (the signed-out shell), so hydration stays consistent.
export function useRequireAuth() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!getToken()) void navigate({ to: "/login" })
  }, [navigate])
}
