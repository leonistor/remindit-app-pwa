import { AppWindowIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "./elements/theme/mode-toggle"
import { ThemeProvider } from "./elements/theme/theme-provider"
import GroupingListExample from "./examples/GroupingList"
import TransferListExample from "./examples/TransferList"

const App = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="remindit-ui-theme">
      <div className="container mx-auto min-h-screen">
        <div className="flex flex-col gap-4">
          <div className="flex h-16 flex-row items-center gap-1">
            <AppWindowIcon size={32} />
            <Separator />
            <ModeToggle />
          </div>
          <div className="flex-1">
            <GroupingListExample />
            <TransferListExample />
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
