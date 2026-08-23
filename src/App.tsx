import { AppWindowIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./components/theme-toggle"
// import GroupingListExample from "./examples/GroupingList"
import ResizableExample from "./examples/Resizable"

const App = () => {
  return (
    <div className="container mx-auto h-screen">
      <div className="flex h-full w-full flex-col gap-4">
        {/*menu*/}
        <div className="flex h-16 flex-row items-stretch gap-1 space-x-2 bg-accent py-2">
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
        {/*content*/}
        <div className="min-h-0 grow">
          <ResizableExample />
        </div>
      </div>
    </div>
  )
}

export default App
