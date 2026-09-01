// Helpers for the /share view: rasterize the on-screen list card to a PNG with
// snapdom, then hand the blob to the clipboard or a browser download.

import { snapdom } from "@zumer/snapdom"

/** PNG filename for the shared list, keyed by the local date (zero-padded). */
export function listImageFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `remindit-list-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.png`
}

/**
 * Rasterize the capture card element into a PNG blob. `embedFonts` inlines the
 * self-hosted app font (Atkinson Hyperlegible Next) so the exported image
 * never falls back to a system font on devices without it.
 */
export async function captureListPng(el: HTMLElement): Promise<Blob> {
  return snapdom.toBlob(el, { type: "png", scale: 2, embedFonts: true })
}

/**
 * Trigger a browser download of a Blob. Uses a temporary object URL + anchor so
 * no extra dependency is needed (same mechanism as downloadLocalData()).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Clipboard image support: `ClipboardItem` + `clipboard.write` are not universal. */
export function canCopyImagesToClipboard(): boolean {
  return (
    typeof window.ClipboardItem !== "undefined" && !!navigator.clipboard?.write
  )
}

/**
 * Write a PNG blob (or a promise resolving to one) to the clipboard. Accepting
 * a promise is deliberate: Safari requires the ClipboardItem to be constructed
 * inside the click gesture, but resolves the promise's value once the capture
 * settles — so the caller can arm the clipboard write synchronously and let
 * the heavy rasterization finish in the background.
 */
export async function copyImageBlobToClipboard(
  source: Blob | Promise<Blob>
): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": source })])
}
