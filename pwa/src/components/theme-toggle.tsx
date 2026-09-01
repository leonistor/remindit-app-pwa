import { useStore } from "@nanostores/react"
import {
  type Icon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import { m } from "@/paraglide/messages"
import { $theme, type ThemeMode } from "@/stores/theme"

// Labels resolve lazily so the active locale is read at render time,
// not frozen at import time.
export const OPTIONS: Record<ThemeMode, { label: () => string; Icon: Icon }> = {
  light: { label: () => m.themeLight(), Icon: SunIcon },
  dark: { label: () => m.themeDark(), Icon: MoonIcon },
  system: { label: () => m.themeSystem(), Icon: MonitorIcon },
}

// Cycle order when clicking the toggle.
export const ORDER: ThemeMode[] = ["light", "dark", "system"]

// Sets an explicit theme mode (used by the menu picker).
export const setTheme = (mode: ThemeMode) => $theme.set(mode)

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
      aria-label={m.themeToggleAriaLabel({ mode: label() })}
      onClick={cycle}
    >
      <Icon size={16} aria-hidden />
    </Button>
  )
}
