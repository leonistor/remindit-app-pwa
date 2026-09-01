// Avatar picker for the Profile page.
//
// The trigger is the profile avatar itself (bare Button + pencil badge). It
// opens a Shark Dialog holding a 4×3 grid of freshly generated DiceBear
// `personas` avatars (random seeds — every open and every reroll draws a new
// batch, un-picked batches are simply discarded). Picking persists
// immediately via `updateUser` and closes, mirroring how PaletteChooser
// couples straight to its store instead of threading callbacks.

import { PencilSimple, Shuffle } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/custom/button"
import { createGridCollection } from "@/components/ui/custom/collection"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
} from "@/components/ui/listbox"
import { Spinner } from "@/components/ui/spinner"
import {
  type AvatarOption,
  generateAvatarOptions,
} from "@/lib/profile-generator"
import { m } from "@/paraglide/messages"
import { updateUser } from "@/stores"

// Arrow-key grid navigation comes from createGridCollection(columnCount);
// the ListboxContent grid class below is its visual twin.
const GRID_COLUMNS = 4

export const AvatarPicker = ({ avatar }: { avatar: string }) => {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<AvatarOption[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  // "Latest load wins" token: reroll/close/unmount invalidate any in-flight
  // generation instead of racing it.
  const batchToken = useRef(0)

  const loadBatch = useCallback(() => {
    const token = ++batchToken.current
    setOptions(null)
    setLoadError(false)
    generateAvatarOptions()
      .then((next) => {
        if (batchToken.current === token) setOptions(next)
      })
      .catch(() => {
        // A stale rejection (rerolled/closed over) must not surface on the
        // newer batch; the token guard covers that, same as the .then side.
        if (batchToken.current === token) setLoadError(true)
      })
  }, [])

  // A fresh batch per open; the cleanup bumps the token so a load that
  // resolves after close (or unmount) is discarded, never leaking into the
  // next open.
  useEffect(() => {
    if (open) loadBatch()
    return () => {
      batchToken.current++
    }
  }, [loadBatch, open])

  const collection = useMemo(
    () =>
      options
        ? createGridCollection({
            items: options,
            itemToValue: (option) => option.seed,
            itemToString: (option) => option.seed,
            columnCount: GRID_COLUMNS,
          })
        : null,
    [options]
  )

  const pick = (seed: string | undefined) => {
    const picked = options?.find((option) => option.seed === seed)
    if (!picked) return
    // The dataUri is persisted; the seed was only the in-batch listbox value.
    updateUser({ avatar: picked.dataUri })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(details) => setOpen(details.open)}>
      <DialogTrigger asChild>
        <Button
          variant="bare"
          aria-label={m.profileAvatarEditLabel()}
          className="size-16 rounded-full p-0"
        >
          <img
            alt={m.profileAvatarAlt()}
            className="size-16 rounded-full border"
            src={avatar}
          />
          {/* Pencil badge marks the avatar as editable; background-tokened
              fill keeps it legible over the image in both themes. */}
          <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border bg-background shadow-sm">
            <PencilSimple className="size-3.5" weight="fill" />
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader title={m.profileAvatarDialogTitle()} />
        <DialogBody>
          {collection ? (
            <Listbox
              aria-label={m.profileAvatarListLabel()}
              collection={collection}
              onValueChange={(details) => pick(details.value[0])}
            >
              <ListboxContent className="grid grid-cols-4 gap-2">
                {collection.items.map((option, index) => (
                  <ListboxItem
                    key={option.seed}
                    item={option}
                    aria-label={m.profileAvatarOptionLabel({
                      index: index + 1,
                    })}
                    className="justify-center p-1.5"
                  >
                    <img
                      alt=""
                      className="pointer-events-none size-12 rounded-full"
                      src={option.dataUri}
                    />
                    {/* Selection check overlaid on the avatar's corner,
                        badge-style so it reads on any palette. */}
                    <ListboxItemIndicator className="absolute right-0.5 bottom-0.5 size-5 rounded-full border bg-background" />
                  </ListboxItem>
                ))}
              </ListboxContent>
            </Listbox>
          ) : loadError ? (
            <div className="flex justify-center py-8">
              <p className="text-destructive text-sm" role="alert">
                {m.profileAvatarLoadError()}
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Spinner aria-label={m.loading()} />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={options === null && !loadError}
            onClick={loadBatch}
            variant="outline"
          >
            <Shuffle size={16} />
            {m.profileAvatarReroll()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
