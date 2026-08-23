import {
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
} from "@/components/ui/resizable"

const ResizableExample = () => (
  <Resizable
    className="h-full rounded-md border"
    defaultSize={[30, 70]}
    orientation="vertical"
    panels={[{ id: "1", minSize: 25, maxSize: 40 }, { id: "2" }]}
  >
    <ResizablePanel className="flex items-center justify-center" id="1">
      Sidebar
    </ResizablePanel>

    <ResizableResizeTrigger id="1:2" withHandle />

    <ResizablePanel className="flex items-center justify-center" id="2">
      Content
    </ResizablePanel>
  </Resizable>
)

export default ResizableExample
