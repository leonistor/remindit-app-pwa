import { useState } from "react"
import { DATASETS, DEFAULT_DATASET_ID } from "seed"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@/components/ui/segment-group"
import { seedFromDataset } from "@/stores"

// First-run dataset (build-time) used as the default picker selection.
const INITIAL_DATASET = import.meta.env.PUBLIC_DATASET ?? DEFAULT_DATASET_ID

const SettingsView = () => {
  const [open, setOpen] = useState(false)
  // The dataset chosen for the upcoming reset — one-shot, not persisted.
  const [dataset, setDataset] = useState<string>(INITIAL_DATASET)

  const handleReset = () => {
    seedFromDataset(dataset)
    setOpen(false)
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h1 className="font-bold text-2xl">Settings</h1>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="Reset & reseed"
          description="Replace all local data with a fresh catalog from the selected dataset."
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            This wipes your shopping list, history, catalog, and profile, then
            reseeds from the chosen dataset. Your theme preference is kept.
          </p>
        </CardContent>
        <CardFooter>
          <Dialog open={open} onOpenChange={(details) => setOpen(details.open)}>
            <DialogTrigger asChild>
              <Button variant="destructive">Reset app & reseed</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader
                title="Reset app and reseed?"
                description="This cannot be undone. Choose which dataset to seed from."
              />
              <DialogBody>
                <SegmentGroup
                  aria-label="Seed dataset"
                  className="w-full"
                  value={dataset}
                  onValueChange={(details) =>
                    setDataset(
                      typeof details.value === "string"
                        ? details.value
                        : (details.value[0] ?? DEFAULT_DATASET_ID)
                    )
                  }
                >
                  {DATASETS.map((d) => (
                    <SegmentGroupItem key={d.id} value={d.id}>
                      <SegmentGroupItemText>{d.name}</SegmentGroupItemText>
                    </SegmentGroupItem>
                  ))}
                </SegmentGroup>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleReset}>
                  Reset & reseed
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SettingsView
