import ItemsPanel from "@/components/items-panel"
import { ShoppingListPanel } from "@/components/shopping-list-panel"
import {
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
} from "@/components/ui/resizable"

const ShoppingPanels = () => (
  <Resizable
    className="h-full rounded-md border"
    defaultSize={[30, 70]}
    orientation="vertical"
    panels={[{ id: "selected", minSize: 25, maxSize: 40 }, { id: "all" }]}
  >
    <ResizablePanel className="flex items-center justify-center" id="selected">
      <ShoppingListPanel title="Selected items" />
    </ResizablePanel>
    <ResizableResizeTrigger id="selected:all" withHandle />
    <ResizablePanel className="flex items-center justify-center" id="all">
      <ItemsPanel title="All items" />
    </ResizablePanel>
  </Resizable>
)

export default ShoppingPanels
