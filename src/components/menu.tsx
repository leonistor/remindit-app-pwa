import {
  Clock,
  Gear,
  Info,
  List,
  Question,
  Rows,
  X,
} from "@phosphor-icons/react"
import { useState } from "react"
import { NavLink } from "react-router"
import { Button } from "@/components/ui/button"
import {
  MenuContent,
  MenuItem,
  Menu as MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./theme-toggle"

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors hover:text-foreground ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`

const navLinks = [
  { to: "/", label: "List", icon: List },
  { to: "/catalog", label: "Catalog", icon: Rows },
  { to: "/history", label: "History", icon: Clock },
  { to: "/settings", label: "Settings", icon: Gear },
  { to: "/about", label: "About", icon: Info },
  { to: "/help", label: "Help", icon: Question },
]

const Menu = () => {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-16 flex-row items-center gap-2 rounded-md border bg-accent px-4">
      <img alt="RemindIt logo" className="size-8" src="/remindit-icon.svg" />
      <Separator orientation="vertical" />
      <span className="font-semibold text-sm">RemindIt</span>

      {/* Desktop nav — always visible on md+ */}
      <nav className="hidden items-center gap-3 md:flex">
        {navLinks.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkClass}>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile: hamburger opens a dropdown menu of the same links */}
      <div className="md:hidden">
        <MenuRoot open={open} onOpenChange={(details) => setOpen(details.open)}>
          <MenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <List size={20} />}
            </Button>
          </MenuTrigger>
          <MenuContent className="w-52">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <MenuItem key={to} value={to} asChild>
                <NavLink
                  to={to}
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              </MenuItem>
            ))}
          </MenuContent>
        </MenuRoot>
      </div>

      <span className="ml-auto">
        <ThemeToggle />
      </span>
    </div>
  )
}

export default Menu
