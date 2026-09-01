import { useStore } from "@nanostores/react"

import { useAutoplayInView } from "@/hooks/use-autoplay-in-view"
import { m } from "@/paraglide/messages"
import { $themeVariant } from "@/stores"

interface DemoVideoProps {
  scenario: string
  "aria-label"?: string
}

/**
 * Embeds a scenario from scripts/demo-scenarios.ts, picking the variant that
 * matches the resolved theme (`public/demos/{scenario}-{light|dark}.mp4`).
 * Autoplay: muted in-view looping via useAutoplayInView — plays while
 * scrolled into the viewport, pauses out of view, and falls back to native
 * controls under prefers-reduced-motion or when the browser blocks play()
 * (e.g. iOS Low Power Mode). preload="auto" warms the file so scroll-triggered
 * starts are instant; a theme flip swapping src re-triggers native autoplay.
 */
export function DemoVideo({ scenario, ...rest }: DemoVideoProps) {
  const variant = useStore($themeVariant)
  const { ref, manual, blocked } = useAutoplayInView()

  return (
    <video
      ref={ref}
      aria-label={rest["aria-label"] ?? m.demoVideoAriaLabel({ scenario })}
      autoPlay={!manual}
      className="mx-auto max-h-[480px] w-auto rounded-lg border bg-muted"
      controls={manual || blocked}
      loop
      muted
      playsInline
      preload="auto"
      src={`/demos/${scenario}-${variant}.mp4`}
    />
  )
}
