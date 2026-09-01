// Unit tests for the share-image helpers (src/lib/share-image).
//
// snapdom is mocked at the module boundary (real rasterization needs a live
// browser); clipboard and download surfaces are stubbed on the happy-dom
// globals. Note: happy-dom keeps `click` on HTMLElement.prototype and
// `clipboard` as a Navigator.prototype getter, so the spies/stubs target those.

import { afterEach, describe, expect, rs, test } from "@rstest/core"
import {
  canCopyImagesToClipboard,
  captureListPng,
  copyImageBlobToClipboard,
  downloadBlob,
  listImageFilename,
} from "@/lib/share-image"

const toBlob = rs.hoisted(() => rs.fn())

rs.mock("@zumer/snapdom", () => ({
  snapdom: { toBlob: toBlob },
}))

// Minimal ClipboardItem double: records the payload so tests can assert what
// would be written to the clipboard without relying on happy-dom's own class.
class FakeClipboardItem {
  readonly types: string[]
  constructor(readonly payload: Record<string, Blob | Promise<Blob>>) {
    this.types = Object.keys(payload)
  }
}

function stubClipboard(value: unknown): void {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true })
}

afterEach(() => {
  rs.unstubAllGlobals()
  // Drop the own-property shadow so the prototype getter is visible again.
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe("listImageFilename", () => {
  test("formats the local date zero-padded", () => {
    expect(listImageFilename(new Date(2026, 7, 31))).toBe(
      "remindit-list-2026-08-31.png"
    )
    expect(listImageFilename(new Date(2027, 0, 5))).toBe(
      "remindit-list-2027-01-05.png"
    )
  })
})

describe("downloadBlob", () => {
  test("downloads via a temporary object-URL anchor and revokes it", () => {
    const blob = new Blob(["png"], { type: "image/png" })
    const createObjectURL = rs
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock")
    const revokeObjectURL = rs
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {})
    let anchor: HTMLAnchorElement | null = null
    const click = rs
      .spyOn(HTMLElement.prototype, "click")
      .mockImplementation(function (this: HTMLElement) {
        anchor = this as HTMLAnchorElement
      })

    try {
      downloadBlob(blob, "remindit-list-2026-08-31.png")

      expect(anchor?.getAttribute("download")).toBe(
        "remindit-list-2026-08-31.png"
      )
      expect(anchor?.getAttribute("href")).toBe("blob:mock")
      expect(click).toHaveBeenCalledTimes(1)
      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock")
    } finally {
      createObjectURL.mockRestore()
      revokeObjectURL.mockRestore()
      click.mockRestore()
    }
  })
})

describe("canCopyImagesToClipboard", () => {
  test("true when ClipboardItem and clipboard.write both exist", () => {
    rs.stubGlobal("ClipboardItem", FakeClipboardItem)
    stubClipboard({ write: rs.fn() })
    expect(canCopyImagesToClipboard()).toBe(true)
  })

  test("false without ClipboardItem", () => {
    rs.stubGlobal("ClipboardItem", undefined)
    stubClipboard({ write: rs.fn() })
    expect(canCopyImagesToClipboard()).toBe(false)
  })

  test("false without clipboard.write", () => {
    rs.stubGlobal("ClipboardItem", FakeClipboardItem)
    stubClipboard(undefined)
    expect(canCopyImagesToClipboard()).toBe(false)
  })
})

describe("copyImageBlobToClipboard", () => {
  test("writes one image/png ClipboardItem and awaits the capture promise", async () => {
    rs.stubGlobal("ClipboardItem", FakeClipboardItem)
    const blob = new Blob(["png"], { type: "image/png" })
    let captured: unknown
    const write = rs.fn(async (items: unknown[]) => {
      captured = items
    })
    stubClipboard({ write })

    await copyImageBlobToClipboard(Promise.resolve(blob))

    expect(write).toHaveBeenCalledTimes(1)
    const items = captured as FakeClipboardItem[]
    expect(items).toHaveLength(1)
    expect(items[0]).toBeInstanceOf(FakeClipboardItem)
    expect(items[0].types).toEqual(["image/png"])
    expect(await items[0].payload["image/png"]).toBe(blob)
  })
})

describe("captureListPng", () => {
  test("delegates to snapdom with forced PNG @2x and embedded fonts", async () => {
    const el = document.createElement("div")
    const blob = new Blob(["png"], { type: "image/png" })
    toBlob.mockReset()
    toBlob.mockResolvedValue(blob)

    const result = await captureListPng(el)

    expect(result).toBe(blob)
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(toBlob).toHaveBeenCalledWith(el, {
      type: "png",
      scale: 2,
      embedFonts: true,
    })
  })
})
