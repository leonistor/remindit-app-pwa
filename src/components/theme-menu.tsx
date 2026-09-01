import { useStore } from "@nanostores/react"
import {
  MenuRadioGroup,
  MenuRadioItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@/components/ui/menu"
import { m } from "@/paraglide/messages"
import { $theme, type ThemeMode } from "@/stores/theme"
import { OPTIONS, ORDER, setTheme } from "./theme-toggle"

// Theme picker rendered as a dropdown submenu. Lets the user pick an explicit
// light/dark/system mode instead of cycling through them.
export function ThemeMenu() {
  const mode = useStore($theme)

  return (
    <MenuSub>
      <MenuSubTrigger>
        {OPTIONS[mode].Icon && <OptionsIcon mode={mode} />}
        {m.themeMenuLabel()}
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuRadioGroup
          value={mode}
          onValueChange={(details) => setTheme(details.value as ThemeMode)}
        >
          {ORDER.map((mode) => {
            const Icon = OPTIONS[mode].Icon
            return (
              <MenuRadioItem key={mode} value={mode}>
                <span className="inline-flex items-center gap-2">
                  <Icon size={16} aria-hidden />
                  {OPTIONS[mode].label()}
                </span>
              </MenuRadioItem>
            )
          })}
        </MenuRadioGroup>
      </MenuSubContent>
    </MenuSub>
  )
}

const OptionsIcon = ({ mode }: { mode: ThemeMode }) => {
  const Icon = OPTIONS[mode].Icon
  return <Icon size={16} aria-hidden />
}
