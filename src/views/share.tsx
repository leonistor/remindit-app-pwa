import { useStore } from "@nanostores/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { BackButton } from "@/components/back-button"
import { Button } from "@/components/ui/custom/button"
import { useCategoryPalette } from "@/hooks/use-category-palette"
import { useShoppingList } from "@/hooks/use-shopping-list"
import {
  canCopyImagesToClipboard,
  captureListPng,
  copyImageBlobToClipboard,
  downloadBlob,
  listImageFilename,
} from "@/lib/share-image"
import { cn } from "@/lib/utils"
import type { SelectedViewEntry } from "@/stores"
import { $categories } from "@/stores"

interface ShareGroup {
  id: string
  name: string
  items: SelectedViewEntry[]
}

interface ShareStatus {
  kind: "success" | "error"
  message: string
}

// Lean static chip for the forced-light capture card. ShoppingItem's palette
// works here (inline --cat/--cat-ink vars survive rasterization), but its
// uncategorized fallback uses theme tokens (bg-accent) that flip in dark mode
// and would break the light-only PNG — so the card renders its own chip with
// an explicit light neutral for that case.
const ShareChip = ({
  name,
  categoryId,
}: {
  name: string
  categoryId: string
}) => {
  const palette = useCategoryPalette(categoryId)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--cat)] px-3 py-1 font-medium text-[color:var(--cat-ink)] text-sm",
        !palette.hex && "bg-neutral-100 text-neutral-800"
      )}
      style={palette.style}
    >
      {name}
    </span>
  )
}

const ShareView = () => {
  const { items } = useShoppingList()
  const categories = useStore($categories)
  const cardRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [status, setStatus] = useState<ShareStatus | null>(null)
  const canCopy = canCopyImagesToClipboard()

  // Unchecked entries grouped by category in $categories order (the same layout
  // rule $itemsByCategory applies). $selectedView normalizes dangling category
  // ids to the always-present uncategorized sentinel, so every key resolves.
  const groups = useMemo<ShareGroup[]>(() => {
    const pending = new Map<string, SelectedViewEntry[]>()
    for (const entry of items) {
      if (entry.checked) continue
      const bucket = pending.get(entry.categoryId)
      if (bucket) bucket.push(entry)
      else pending.set(entry.categoryId, [entry])
    }
    return categories.flatMap((category) => {
      const bucket = pending.get(category.id)
      return bucket
        ? [{ id: category.id, name: category.name, items: bucket }]
        : []
    })
  }, [items, categories])

  // Keep the live region mounted (no layout shift) and clear feedback shortly.
  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(null), 4000)
    return () => window.clearTimeout(timer)
  }, [status])

  const handleCopy = () => {
    const card = cardRef.current
    if (!card) return
    setStatus(null)
    setCapturing(true)
    try {
      // Safari requires ClipboardItem construction within the click gesture:
      // start the capture synchronously and pass the still-pending promise.
      const capture = captureListPng(card)
      copyImageBlobToClipboard(capture)
        .then(() =>
          setStatus({ kind: "success", message: "Copied to clipboard" })
        )
        .catch(() =>
          setStatus({
            kind: "error",
            message: "Couldn't copy the image — try downloading it instead",
          })
        )
        .finally(() => setCapturing(false))
    } catch {
      setStatus({
        kind: "error",
        message: "Couldn't copy the image — try downloading it instead",
      })
      setCapturing(false)
    }
  }

  const handleDownload = async () => {
    const card = cardRef.current
    if (!card) return
    setStatus(null)
    setCapturing(true)
    try {
      const blob = await captureListPng(card)
      downloadBlob(blob, listImageFilename())
      setStatus({ kind: "success", message: "Image downloaded" })
    } catch {
      setStatus({ kind: "error", message: "Couldn't download the image" })
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="font-bold text-2xl">Share</h1>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing left to share — check items off as you shop.
        </p>
      ) : (
        <>
          {/* Forced-light card: hard-coded light colors (no theme tokens) so
              the exported PNG is identical in the app's dark mode. This node
              is both the WYSIWYG preview and the snapdom capture target. */}
          <div className="flex justify-center">
            <div
              ref={cardRef}
              className="flex w-[380px] flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6 text-neutral-800 shadow-sm"
              data-testid="share-card"
            >
              <header className="flex items-center gap-2">
                <img
                  alt="RemindIt logo"
                  className="size-8 rounded-full"
                  src="/remindit-icon.svg"
                />
                <span className="font-bold text-lg text-neutral-900">
                  RemindIt
                </span>
              </header>
              <div className="flex flex-col gap-1">
                <h2 className="font-bold text-neutral-900 text-xl">
                  Shopping list
                </h2>
                <p className="text-neutral-500 text-sm">
                  {new Date().toLocaleDateString(undefined, {
                    dateStyle: "long",
                  })}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <section className="flex flex-col gap-2" key={group.id}>
                    <h3 className="font-semibold text-neutral-500 text-xs uppercase tracking-wide">
                      {group.name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((entry) => (
                        <ShareChip
                          categoryId={entry.categoryId}
                          key={entry.entryId}
                          name={entry.name}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Button disabled={capturing || !canCopy} onClick={handleCopy}>
                Copy image
              </Button>
              <Button
                disabled={capturing}
                onClick={handleDownload}
                variant="outline"
              >
                Download PNG
              </Button>
            </div>
            {!canCopy && (
              <p className="text-muted-foreground text-xs">
                Copying isn&rsquo;t available in this browser — use Download
                instead
              </p>
            )}
            <p
              aria-live="polite"
              className={cn(
                "text-sm",
                status
                  ? status.kind === "success"
                    ? "text-success"
                    : "text-destructive"
                  : "invisible"
              )}
            >
              {status?.message ?? ""}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default ShareView
