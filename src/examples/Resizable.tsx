import {
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
} from "@/components/ui/resizable"
import AllItemsExample from "./AllItemsExample"

const ResizableExample = () => (
  <Resizable
    className="h-full rounded-md border"
    defaultSize={[30, 70]}
    orientation="vertical"
    panels={[{ id: "selected", minSize: 25, maxSize: 40 }, { id: "all" }]}
  >
    <ResizablePanel className="flex items-center justify-center" id="selected">
      <AllItemsExample title="Selected items" />
    </ResizablePanel>

    <ResizableResizeTrigger id="selected:all" withHandle />

    <ResizablePanel className="flex items-center justify-center" id="all">
      <AllItemsExample title="All items" />
    </ResizablePanel>
  </Resizable>
)

export default ResizableExample
