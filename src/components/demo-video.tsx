import { useStore } from "@nanostores/react"

import { $themeVariant } from "@/stores"

interface DemoVideoProps {
  scenario: string
  "aria-label"?: string
}

/**
 * Embeds a scenario from scripts/demo-scenarios.ts, picking the variant that
 * matches the resolved theme (`public/demos/{scenario}-{light|dark}.mp4`).
 * Native controls: the Help page is user-paced reading, not an autoplay tour.
 * preload="metadata" is enough to paint the first frame without fetching the
 * whole file, so a theme flip swapping src is a cheap metadata reload.
 */
export function DemoVideo({ scenario, ...rest }: DemoVideoProps) {
  const variant = useStore($themeVariant)

  return (
    // biome-ignore lint/a11y/useMediaCaption: generated demo screencasts ship without caption assets
    <video
      aria-label={rest["aria-label"] ?? `Demo: ${scenario}`}
      className="mx-auto max-h-[480px] w-auto rounded-lg border bg-muted"
      controls
      playsInline
      preload="metadata"
      src={`/demos/${scenario}-${variant}.mp4`}
    />
  )
}
