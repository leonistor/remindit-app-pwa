import { useEffect, useRef, useState } from "react"

// Play only once the video is mostly on screen, so partially scrolled-in
// videos don't start (and out-of-view ones have already stopped).
const AUTOPLAY_THRESHOLD = 0.5

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * Muted in-view autoplay for demo videos. Attaches an IntersectionObserver to
 * the returned `ref`: the video plays while ≥50% visible and pauses when it
 * scrolls out. A rejected `play()` (autoplay policy, iOS Low Power Mode) stops
 * retrying and flips `blocked`, so callers can reveal native controls.
 *
 * `manual` is true when the user prefers reduced motion — callers should skip
 * autoplay entirely and show controls instead. Pair with the `autoPlay`
 * attribute (`autoPlay={!manual}`) so a theme flip that swaps `src` restarts
 * playback natively without waiting for a new intersection change.
 */
export function useAutoplayInView() {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [manual] = useState(prefersReducedMotion)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (manual) return
    const video = ref.current
    if (!video) return

    // Ancient browsers without IntersectionObserver get the controls fallback.
    if (typeof IntersectionObserver === "undefined") {
      setBlocked(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              observer.disconnect()
              setBlocked(true)
            })
          } else {
            video.pause()
          }
        }
      },
      { threshold: AUTOPLAY_THRESHOLD }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [manual])

  return { ref, manual, blocked }
}
