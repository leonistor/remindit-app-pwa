import { CircleIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme, type Theme } from "@/elements/theme/theme-provider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      multiple={false}
      value={[theme]}
      onValueChange={({ value }) => value[0] && setTheme(value[0] as Theme)}
    >
      <ToggleGroupItem aria-label="system" value="system">
        <CircleIcon size={24} />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="light" value="light">
        <SunIcon size={24} />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="dark" value="dark">
        <MoonIcon size={24} />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
