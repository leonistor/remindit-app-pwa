import { DownloadSimple } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/custom/button"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { dismissInstall, dismissLater, installApp } from "@/stores/pwa-install"

// Non-blocking prompt for Chromium browsers that offer a native install. Hidden
// once installed, dismissed forever ("No"), or dismissed for this session
// ("Maybe later", which resets on the next app open). Appears shortly after the
// app becomes installable so it doesn't pop in on the first paint.
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      {/* role="status" + aria-live announce the banner when it appears 1.5s after mount. */}
      <div
        role="status"
        aria-live="polite"
        className="tm-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg"
      >
        <DownloadSimple size={20} className="shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Install Remindit</p>
          <p className="text-muted-foreground">
            Add it to your device for quick, offline access.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={dismissLater}>
            Maybe later
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissInstall}>
            No
          </Button>
          <Button size="sm" onClick={() => installApp()}>
            Install
          </Button>
        </div>
      </div>
    </div>
  )
}
