import { createBrowserRouter, Outlet } from "react-router"
import Menu from "./components/menu"
import ShoppingPanels from "./components/shopping-panels"
import AboutView from "./views/about"
import CatalogView from "./views/catalog"
import HelpView from "./views/help"
import HistoryView from "./views/history"
import SettingsView from "./views/settings"

function Layout() {
  return (
    <div className="container mx-auto h-screen px-4 py-4">
      <div className="flex h-full w-full flex-col gap-4">
        <Menu />
        <div className="min-h-0 grow">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <ShoppingPanels /> },
      { path: "/catalog", element: <CatalogView /> },
      { path: "/history", element: <HistoryView /> },
      { path: "/settings", element: <SettingsView /> },
      { path: "/about", element: <AboutView /> },
      { path: "/help", element: <HelpView /> },
    ],
  },
])
