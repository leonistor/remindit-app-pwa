import { useEffect, useState } from "react"
import { DownloadSimple, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import { dismissInstall, installApp, usePwaInstall } from "@/stores/pwa-install"

// Non-blocking prompt for Chromium browsers that offer a native install. Hidden
// once installed or dismissed (dismissal is persisted, so it never reappears).
// Appears shortly after the app becomes installable so it doesn't pop in on the
// first paint.
export function InstallBanner() {
  const { showBanner } = usePwaInstall()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!showBanner) {
      setMounted(false)
      return
    }
    const timer = setTimeout(() => setMounted(true), 1500)
    return () => clearTimeout(timer)
  }, [showBanner])

  if (!mounted || !showBanner) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
        <DownloadSimple size={20} className="shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Install Remindit</p>
          <p className="text-muted-foreground">
            Add it to your device for quick, offline access.
          </p>
        </div>
        <Button size="sm" onClick={() => installApp()}>
          Install
        </Button>
        <Button
          aria-label="Dismiss install prompt"
          size="icon-sm"
          variant="ghost"
          onClick={dismissInstall}
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  )
}
