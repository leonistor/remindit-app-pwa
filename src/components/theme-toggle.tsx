import { useStore } from "@nanostores/react"
import {
  type Icon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import { type ThemeMode, $theme } from "@/stores/theme"

const OPTIONS: Record<ThemeMode, { label: string; Icon: Icon }> = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: MonitorIcon },
}

// Cycle order when clicking the toggle.
const ORDER: ThemeMode[] = ["light", "dark", "system"]

export function ThemeToggle() {
  const mode = useStore($theme)
  const { label, Icon } = OPTIONS[mode]

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
    $theme.set(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Theme: ${label}. Click to change.`}
      onClick={cycle}
    >
      <Icon size={16} aria-hidden />
    </Button>
  )
}
