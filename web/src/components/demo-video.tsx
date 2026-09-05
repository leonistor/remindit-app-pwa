// Marketing-page demo embed. Differently from the pwa's DemoVideo (theme
// variant + in-view autoplay), this is deliberately conservative: preload="
// none" and a screenshot poster mean nothing downloads until the visitor taps
// play — no autoplay on a public page. The mp4s and poster pngs are committed
// static assets in web/public (the pwa's copies are generated + gitignored).
import { m } from "../paraglide/messages"

interface DemoVideoProps {
  /** Public path to the mp4 (web/public/demos/). */
  src: string
  /** Accessible label describing the scenario. */
  label: string
  /** Poster screenshot shown before playback (web/public/screenshots/). */
  poster: string
}

export function DemoVideo({ src, label, poster }: DemoVideoProps) {
  return (
    <figure className="demo-video">
      <video
        aria-label={label}
        className="demo-video-player"
        controls
        loop
        muted
        playsInline
        poster={poster}
        preload="none"
        src={src}
      />
      <figcaption className="demo-video-caption">{m.webVideoHint()}</figcaption>
    </figure>
  )
}