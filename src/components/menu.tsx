import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./theme-toggle"

const Menu = () => (
  <div className="flex h-16 flex-row items-center gap-2 rounded-md border bg-accent px-4">
    <img alt="RemindIt logo" className="size-8" src="/remindit-icon.svg" />
    <Separator orientation="vertical" />
    <span>RemindIt</span>
    <Separator orientation="vertical" />
    <span className="ml-auto">
      <ThemeToggle />
    </span>
  </div>
)

export default Menu
