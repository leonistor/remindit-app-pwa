import { TrashIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useSwipeable } from "react-swipeable"
import { Button } from "@/components/ui/custom/button"
import { cn } from "@/lib/utils"

interface SwipeableItemRowProps {
  /** Row content (name + actions). Rendered as foreground that translates on swipe. */
  children: React.ReactNode
  /** Called when delete is confirmed/opened. Actual deletion is owned by caller via dialog. */
  onDelete: () => void
  /** Accessible label for the delete action. */
  deleteLabel: string
  /** Whether swipe is enabled (only on mobile). */
  enabled: boolean
}

/**
 * Swipe-to-reveal delete row for mobile catalog items.
 *
 * - Swiping left reveals the delete button behind the foreground.
 * - Swiping right or tapping the row closes it.
 * - Uses `react-swipeable` for reliable touch/mouse tracking.
 * - `preventScrollOnSwipe` is false for horizontal swipe so vertical scroll still works;
 *   `trackMouse` enables desktop drag preview (but `enabled` gates it).
 */
export const SwipeableItemRow = ({
  children,
  onDelete,
  deleteLabel,
  enabled,
}: SwipeableItemRowProps) => {
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const DELETE_WIDTH = 80

  // Reset if disabled (e.g. viewport resized to desktop)
  if (!enabled && (offset !== 0 || revealed)) {
    // Defer to next tick to avoid setState during render warnings in strict mode,
    // but sync reset is safe for this conditional.
    setOffset(0)
    setRevealed(false)
  }

  const handlers = useSwipeable({
    onSwiping: (data) => {
      if (!enabled) return
      // Only handle horizontal swipes
      if (Math.abs(data.deltaX) < Math.abs(data.deltaY)) return
      // deltaX is negative on left swipe, positive on right swipe
      if (data.deltaX < 0) {
        // Swiping left: drag up to DELETE_WIDTH
        const next = Math.max(data.deltaX, -DELETE_WIDTH)
        setOffset(revealed ? next - DELETE_WIDTH : next)
      } else if (revealed) {
        // Swiping right while revealed: drag back
        const next = Math.min(data.deltaX - DELETE_WIDTH, 0)
        setOffset(next)
      }
    },
    onSwiped: (data) => {
      if (!enabled) return
      if (data.dir === "Left") {
        // If swiped left with enough velocity/distance, snap open
        if (-data.deltaX > 40 || -data.velocity > 0.3 || revealed) {
          setOffset(-DELETE_WIDTH)
          setRevealed(true)
        } else {
          setOffset(0)
          setRevealed(false)
        }
      } else if (data.dir === "Right") {
        setOffset(0)
        setRevealed(false)
      } else {
        // Up/Down or not enough swipe: settle to current state
        setOffset(revealed ? -DELETE_WIDTH : 0)
      }
    },
    onTouchEndOrOnMouseUp: () => {
      if (!enabled) return
      // Snap to nearest state if user lifted mid-swipe without triggering onSwiped
      if (!revealed && offset < -DELETE_WIDTH / 2) {
        setOffset(-DELETE_WIDTH)
        setRevealed(true)
      } else if (revealed && offset > -DELETE_WIDTH / 2) {
        setOffset(0)
        setRevealed(false)
      } else {
        setOffset(revealed ? -DELETE_WIDTH : 0)
      }
    },
    delta: 10,
    preventScrollOnSwipe: false,
    trackMouse: false,
    trackTouch: true,
  })

  const close = () => {
    setOffset(0)
    setRevealed(false)
  }

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <div
      {...handlers}
      className="relative overflow-hidden rounded-lg border bg-card"
      // Ensure vertical scroll isn't blocked
      style={{ touchAction: "pan-y" }}
    >
      {/* Delete layer behind. Hidden from AT while closed — it is fully
          covered by the foreground and its button is unfocusable then. */}
      <div
        aria-hidden={!revealed}
        className="absolute inset-y-0 right-0 flex w-[80px] items-center justify-center bg-destructive"
      >
        <Button
          variant="ghost"
          size="sm"
          aria-label={deleteLabel}
          className="h-full w-full rounded-none text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
          onClick={() => {
            close()
            onDelete()
          }}
          tabIndex={revealed ? 0 : -1}
        >
          <TrashIcon weight="bold" />
          Delete
        </Button>
      </div>

      {/* Foreground that translates */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: swipe row tap-to-close is supplemental; row content handles keyboard */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: foreground is swipe container, not interactive itself */}
      <div
        className={cn(
          "relative flex items-center bg-card transition-transform duration-200 ease-out",
          !revealed && offset === 0 && "transition-transform",
          revealed || offset !== 0 ? "duration-0" : ""
        )}
        style={{
          transform: `translateX(${offset}px)`,
          // While actively dragging, disable transition
          transitionDuration: offset !== 0 && !revealed ? "0ms" : undefined,
        }}
        onClick={() => {
          if (revealed) {
            // Tap foreground while revealed closes it instead of triggering edit
            close()
          }
        }}
      >
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
