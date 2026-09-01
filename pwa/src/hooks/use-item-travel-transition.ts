import { useCallback } from "react"
import { flushSync } from "react-dom"

// Drives a "shared element" morph between the catalog (available items) and the
// shopping list using the native View Transitions API — the same technology
// React's <ViewTransition> wraps, but used directly because the catalog keeps
// every item mounted (selecting only flips a style), so React's delete+insert
// "share" detection never fires here.
//
// On each travel we tag the *source* DOM node with a unique `view-transition-name`
// for the before-snapshot, mutate the store, then tag the *target* node for the
// after-snapshot. The browser animates the element between the two positions.
// Names are cleared afterwards so they never linger/duplicate.

type ViewTransition = {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransition
}

const nameFor = (itemId: string) => `travel-${itemId}`

// Both sides carry a travel attribute keyed by itemId; the catalog copy uses
// `data-vt-catalog` and the list copy uses `data-vt-list`. Querying both lets
// the hook unambiguously find the *opposite* side (the transition target),
// regardless of DOM order.
const selectorFor = (itemId: string) =>
  `[data-vt-catalog="${itemId}"], [data-vt-list="${itemId}"]`

const clearNames = (itemId: string) => {
  document.querySelectorAll<HTMLElement>(selectorFor(itemId)).forEach((el) => {
    el.style.viewTransitionName = ""
  })
}

const supportsViewTransitions = () =>
  typeof document !== "undefined" &&
  typeof (document as DocumentWithVT).startViewTransition === "function"

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * Returns `runTravel`, which animates `mutate` as a shared-element transition
 * between the clicked source node and the matching tagged `[data-vt-*]` node on
 * the opposite side. Degrades to an immediate `mutate()` when the API is
 * unavailable or the user prefers reduced motion, in which case `isSupported`
 * is false so callers can fall back to their own (non-VT) animation.
 */
export function useItemTravelTransition() {
  const isSupported = supportsViewTransitions() && !prefersReducedMotion()

  const runTravel = useCallback(
    (itemId: string, sourceEl: HTMLElement | null, mutate: () => void) => {
      const doc = document as DocumentWithVT
      if (!sourceEl || !supportsViewTransitions() || prefersReducedMotion()) {
        mutate()
        return
      }

      const name = nameFor(itemId)
      sourceEl.style.viewTransitionName = name

      const transition = doc.startViewTransition?.(async () => {
        // Release the source name so it isn't duplicated in the "new" snapshot
        // (the catalog copy stays mounted, so only the target may carry it).
        sourceEl.style.viewTransitionName = ""
        flushSync(mutate)
        // The target is whichever tagged node isn't the source (the opposite
        // side of the travel). It may have just mounted (add) or still be the
        // other persistent copy (catalog <-> list).
        const target = Array.from(
          document.querySelectorAll<HTMLElement>(selectorFor(itemId))
        ).find((el) => el !== sourceEl)
        if (target) target.style.viewTransitionName = name
      })

      transition?.finished.finally(() => clearNames(itemId))
    },
    []
  )

  return { runTravel, isSupported }
}
