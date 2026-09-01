import { ArrowClockwise } from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import { useServiceWorkerUpdate } from "@/hooks/use-sw-update"

/**
 * Shows a non-blocking "update available" prompt once a new service worker is
 * waiting. Tapping Reload activates the new version and reloads the app.
 */
export function UpdatePrompt() {
  const { waiting, applyUpdate } = useServiceWorkerUpdate()
  if (!waiting) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <div className="tm-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
        <div className="flex-1 text-sm">
          <p className="font-medium">Update available</p>
          <p className="text-muted-foreground">
            A new version of Remindit is ready.
          </p>
        </div>
        <Button size="sm" onClick={applyUpdate}>
          <ArrowClockwise size={16} aria-hidden />
          Reload
        </Button>
      </div>
    </div>
  )
}
