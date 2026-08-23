import { CircleIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme } from "@/elements/theme/theme-provider"

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <ToggleGroup defaultValue={["system"]} multiple={false}>
      <ToggleGroupItem
        aria-label="system"
        value="bold"
        onClick={() => setTheme("system")}
      >
        <CircleIcon size={24} />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="light"
        value="light"
        onClick={() => setTheme("light")}
      >
        <SunIcon size={24} />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="dark"
        value="dark"
        onClick={() => setTheme("dark")}
      >
        <MoonIcon size={24} />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
