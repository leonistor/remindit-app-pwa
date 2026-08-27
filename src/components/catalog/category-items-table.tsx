import { TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type CatalogByCategoryItem,
  removeCatalogItem,
  renameCatalogItem,
} from "@/stores"
import { InlineEditableName } from "./inline-editable-name"

interface CategoryItemsTableProps {
  items: CatalogByCategoryItem[]
}

// Renders a category's items in a Shark Table. The name cell is an inline
// Editable (commits via `renameCatalogItem`) and the trailing cell holds the
// delete control for that item.
export const CategoryItemsTable = ({ items }: CategoryItemsTableProps) => {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No items yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="w-12 text-right">
            <span className="sr-only">Delete</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <InlineEditableName
                value={item.name}
                onCommit={(next) => renameCatalogItem(item.id, next)}
                ariaLabel={`Rename ${item.name}`}
                placeholder="Unnamed item"
              />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${item.name}`}
                onClick={() => removeCatalogItem(item.id)}
              >
                <TrashIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
