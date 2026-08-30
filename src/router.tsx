import { useStore } from "@nanostores/react"
import { lazy, Suspense, useEffect } from "react"
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
import OnboardingView from "./views/onboarding"

// Secondary routes are code-split so the main shopping view (the LCP) ships
// without their bundles. The home route stays eager on purpose.
const AboutView = lazy(() => import("@/views/about"))
const CatalogView = lazy(() => import("@/views/catalog"))
const ChangelogView = lazy(() => import("@/views/changelog"))
const HelpView = lazy(() => import("@/views/help"))
const HistoryView = lazy(() => import("@/views/history"))
const ProfileView = lazy(() => import("@/views/profile"))

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
            <main className="flex min-h-0 grow flex-col">
              <Suspense fallback={<div className="p-4 text-muted-foreground text-sm">Loading…</div>}>
                <Outlet />
              </Suspense>
              {!isHome && (
                <div className="mt-auto">
                  <Footer />
                </div>
              )}
            </main>
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
