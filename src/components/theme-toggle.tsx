"use client"

import { useStore } from "@nanostores/react"
import {
  type Icon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type ThemeMode, themeStore } from "@/stores/theme"

const OPTIONS: { value: ThemeMode; label: string; Icon: Icon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
]

export function ThemeToggle() {
  const mode = useStore(themeStore)

  return (
    <ToggleGroup
      multiple={false}
      deselectable={false}
      value={[mode]}
      aria-label="Theme"
      size="sm"
      onValueChange={(details) => {
        const next = details.value[0]
        if (next) themeStore.set(next as ThemeMode)
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label}>
          <Icon size={16} aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
