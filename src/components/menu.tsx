import { NavLink } from "react-router"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./theme-toggle"

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors hover:text-foreground ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`

const Menu = () => (
  <div className="flex h-16 flex-row items-center gap-2 rounded-md border bg-accent px-4">
    <img alt="RemindIt logo" className="size-8" src="/remindit-icon.svg" />
    <Separator orientation="vertical" />
    <span className="font-semibold text-sm">RemindIt</span>
    <Separator orientation="vertical" />
    <nav className="flex items-center gap-3">
      <NavLink to="/" className={linkClass}>
        List
      </NavLink>
      <NavLink to="/catalog" className={linkClass}>
        Catalog
      </NavLink>
      <NavLink to="/history" className={linkClass}>
        History
      </NavLink>
      <NavLink to="/settings" className={linkClass}>
        Settings
      </NavLink>
      <NavLink to="/about" className={linkClass}>
        About
      </NavLink>
      <NavLink to="/help" className={linkClass}>
        Help
      </NavLink>
    </nav>
    <span className="ml-auto">
      <ThemeToggle />
    </span>
  </div>
)

export default Menu
