import {
  Clock,
  Info,
  List,
  Question,
  Rows,
  User,
  X,
} from "@phosphor-icons/react"
import { useState } from "react"
import { NavLink } from "react-router"
import { Button } from "@/components/ui/custom/button"
import {
  MenuContent,
  MenuItem,
  Menu as MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
import { ThemeToggle } from "./theme-toggle"

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors hover:text-foreground ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`

const navLinks = [
  { to: "/", label: "Shopping list", icon: List },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/catalog", label: "Catalog", icon: Rows },
  { to: "/history", label: "History", icon: Clock },
  { to: "/about", label: "About", icon: Info },
  { to: "/help", label: "Help", icon: Question },
]

const MOBILE_NAV_LINKS = navLinks.filter((l) => l.to !== "/")

const Menu = () => {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-16 shrink-0 flex-row items-center gap-2 rounded-md border bg-accent px-4">
      {/* Brand marks double as a link to the Shopping list. */}
      <NavLink
        to="/"
        aria-label="RemindIt — Shopping list"
        className="flex items-center gap-2 rounded-md hover:opacity-80"
      >
        <img
          alt="RemindIt logo"
          className="size-8 rounded-full"
          src="/remindit-icon.svg"
        />
        <span className="font-semibold text-sm">RemindIt</span>
      </NavLink>

      {/* Single hamburger menu for every viewport (KISS): the same links the
          mobile dropdown used to show. */}
      <div className="ml-auto flex items-center gap-2">
        <NavLink to="/" className={linkClass}>
          Shopping list
        </NavLink>
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
            {MOBILE_NAV_LINKS.map(({ to, label, icon: Icon }) => (
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
        <ThemeToggle />
      </div>
    </div>
  )
}

export default Menu
