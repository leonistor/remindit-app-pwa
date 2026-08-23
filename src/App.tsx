import Menu from "./components/menu"
// import GroupingListExample from "./examples/GroupingList"
import ShoppingPanels from "./components/shopping-panels"

const App = () => {
  return (
    <div className="container mx-auto h-screen px-4 py-4">
      <div className="flex h-full w-full flex-col gap-4">
        {/*menu*/}
        <Menu />
        {/*content*/}
        <div className="min-h-0 grow">
          <ShoppingPanels />
        </div>
      </div>
    </div>
  )
}

export default App
