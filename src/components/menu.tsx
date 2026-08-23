import { AppWindowIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./theme-toggle"

const Menu = () => (
  <div className="flex h-16 flex-row items-center gap-2 rounded-md border bg-accent px-4">
    <span>
      <AppWindowIcon size={32} />
    </span>
    <Separator orientation="vertical" />
    <span>RemindIt</span>
    <Separator orientation="vertical" />
    <span>
      <ThemeToggle />
    </span>
  </div>
)

export default Menu
