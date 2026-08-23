import { AppWindowIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"

import GroupingListExample from "./examples/GroupingList"

const App = () => {
  return (
    <div className="container mx-auto min-h-screen">
      <div className="flex flex-col gap-4">
        {/*menu*/}
        <div className="flex h-16 flex-1 flex-row items-center gap-1">
          <span>
            <AppWindowIcon size={32} />
          </span>
          <Separator orientation="vertical" />
          <span>RemindIt</span>
          <Separator orientation="vertical" />
          <span>theme</span>
        </div>
        {/*content*/}
        <div className="grow">
          <p>Content here</p>
          <GroupingListExample />
        </div>
      </div>
    </div>
  )
}

export default App
