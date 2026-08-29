import {
  Clock,
  DownloadSimple,
  Info,
  List,
  Plus,
  Question,
  Rows,
  User,
  X,
} from "@phosphor-icons/react"
import { useState } from "react"
import { NavLink } from "react-router"
import { useStore } from "@nanostores/react"
import { Button } from "@/components/ui/custom/button"
import {
  MenuContent,
  MenuItem,
  Menu as MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { installApp, $user, usePwaInstall } from "@/stores"
import { ThemeMenu } from "./theme-menu"
import { QuickAddDialog } from "./quick-add-dialog"
import { InstallInstructionsDialog } from "./install-instructions-dialog"

const avatarInitials = (user: {
  firstName: string
  lastName: string
  username: string
}) => {
  const fromName = `${user.firstName} ${user.lastName}`.trim()
  const source = fromName || user.username
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

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

const ProfileAvatarLink = () => {
  const user = useStore($user)
  return (
      <NavLink
        to="/profile"
        aria-label="Your profile"
        className="inline-flex items-center rounded-full hover:opacity-80"
      >
      <Avatar size="md">
        {user.avatar ? (
          <AvatarImage
            src={user.avatar}
            alt={user.firstName || user.username}
          />
        ) : null}
        <AvatarFallback>{avatarInitials(user)}</AvatarFallback>
      </Avatar>
    </NavLink>
  )
}

const MOBILE_NAV_LINKS = navLinks.filter((l) => l.to !== "/")

const Menu = () => {
  const [open, setOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { canInstall, installed, platform } = usePwaInstall()

  const handleInstall = () => {
    setOpen(false)
    // Chromium offers a native prompt; everyone else gets manual steps.
    if (canInstall) void installApp()
    else setInstallOpen(true)
  }

  return (
    <div className="flex h-16 shrink-0 flex-row items-center gap-2 rounded-md border bg-accent px-4">
      {/* Round logo links home; the wordmark is replaced by the user avatar
          (links to Profile) per the Phase 4 plan. */}
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
      </NavLink>

      <ProfileAvatarLink />

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
            {!installed && (
              <MenuItem value="install-app" onClick={handleInstall}>
                <DownloadSimple size={16} />
                Install Remindit
              </MenuItem>
            )}
            <MenuSeparator />
            <ThemeMenu />
          </MenuContent>
        </MenuRoot>
        <Button
          variant="default"
          size="icon-md"
          aria-label="Add to shopping list"
          onClick={() => setQuickAddOpen(true)}
        >
          <Plus size={18} aria-hidden />
        </Button>
        <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      </div>

      <InstallInstructionsDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        platform={platform}
      />
    </div>
  )
}

export default Menu
