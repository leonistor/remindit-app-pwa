import { useCallback, useEffect, useState } from "react"

const SKIP_WAITING = "SKIP_WAITING"

/**
 * Detects a new service worker version sitting in the `waiting` state and
 * exposes a function to activate it. Relies on the Workbox-generated SW's
 * built-in "SKIP_WAITING" message handler, so we never call `skipWaiting()`
 * unconditionally (which would silently disrupt open sessions).
 */
export function useServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let active = true

    const handleStateChange = (worker: ServiceWorker) => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        setWaiting(true)
      }
    }

    const attach = (registration: ServiceWorkerRegistration) => {
      if (!active) return
      // A build already shipped a waiting worker before this component mounted.
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(true)
        return
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener("statechange", () => handleStateChange(worker))
      })
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) attach(registration)
    })

    return () => {
      active = false
    }
  }, [])

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.getRegistration().then((registration) => {
      const worker = registration?.waiting
      if (!worker) return
      worker.postMessage({ type: SKIP_WAITING })
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") window.location.reload()
      })
    })
  }, [])

  return { waiting, applyUpdate }
}
