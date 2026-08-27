import { useStore } from "@nanostores/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  $recommendationsByItemId,
  type CatalogByCategoryItem,
  renameCatalogItem,
} from "@/stores"
import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"
import { InlineEditableName } from "./inline-editable-name"

interface CategoryItemsTableProps {
  items: CatalogByCategoryItem[]
}

// Renders a category's items in a Shark Table. The name cell is an inline
// Editable (commits via `renameCatalogItem`) and the status cell shows the
// item's recommendation tier dot, if any. Designed so a future "move to
// another category" control can slot into an extra column without restructuring.
export const CategoryItemsTable = ({ items }: CategoryItemsTableProps) => {
  const recommendations = useStore($recommendationsByItemId)

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No items yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="w-24 text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const tier = recommendations.get(item.id)?.tier
          const tierMeta = tier ? RECOMMENDATION_TIERS[tier] : undefined
          return (
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
                {tierMeta?.dotColor ? (
                  <span
                    role="img"
                    className={`inline-block size-2.5 rounded-full ${tierMeta.dotColor}`}
                    aria-label={tierMeta.label}
                    title={tierMeta.label}
                  />
                ) : (
                  <span className="text-muted-foreground" title="No recommendation">
                    —
                  </span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
