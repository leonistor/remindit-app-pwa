import { useStore } from "@nanostores/react"
import { useEffect } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router"
import { $onboarded, initPwaInstall } from "@/stores"
import { DrawerProvider } from "./components/drawer-context"
import { Footer } from "./components/footer"
import { InstallBanner } from "./components/install-banner"
import { ItemDetailDrawer } from "./components/item-detail-drawer"
import { UpdatePrompt } from "./components/update-prompt"
import Menu from "./components/menu"
import ShoppingPanels from "./components/shopping-panels"
import AboutView from "./views/about"
import CatalogView from "./views/catalog"
import ChangelogView from "./views/changelog"
import HelpView from "./views/help"
import HistoryView from "./views/history"
import OnboardingView from "./views/onboarding"
import ProfileView from "./views/profile"

function Layout() {
  const { pathname } = useLocation()
  const isHome = pathname === "/"
  const onboarded = useStore($onboarded)

  // Wire the PWA install-prompt listener once the app shell mounts.
  useEffect(() => {
    initPwaInstall()
  }, [])

  // First-run gate: un-onboarded users are sent to the onboarding flow, which
  // lives outside this Layout (so the menu never shows). Onboarding redirects
  // home once complete.
  if (!onboarded) return <Navigate to="/onboarding" replace />

  return (
    <DrawerProvider>
      <div className="container h-screen">
        <div className="flex h-full w-full flex-col gap-4">
          <Menu />
          <div className="flex min-h-0 grow flex-col overflow-y-auto">
            <Outlet />
            {!isHome && (
              <div className="mt-auto">
                <Footer />
              </div>
            )}
          </div>
        </div>
      </div>
      <ItemDetailDrawer />
      <InstallBanner />
      <UpdatePrompt />
    </DrawerProvider>
  )
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <ShoppingPanels /> },
      { path: "/catalog", element: <CatalogView /> },
      { path: "/history", element: <HistoryView /> },
      { path: "/profile", element: <ProfileView /> },
      { path: "/about", element: <AboutView /> },
      { path: "/changelog", element: <ChangelogView /> },
      { path: "/help", element: <HelpView /> },
    ],
  },
  // Onboarding is a top-level route with no menu chrome.
  { path: "/onboarding", element: <OnboardingView /> },
])
