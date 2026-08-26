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
    panels={[{ id: "selected", minSize: 25, maxSize: 90 }, { id: "all" }]}
  >
    <ResizablePanel className="min-h-0 overflow-hidden" id="selected">
      <ShoppingListPanel />
    </ResizablePanel>
    <ResizableResizeTrigger id="selected:all" withHandle />
    <ResizablePanel className="min-h-0 overflow-hidden" id="all">
      <ItemsPanel />
    </ResizablePanel>
  </Resizable>
)

export default ShoppingPanels
