// Unit tests for the active-palette store (src/stores/palette).
//
// Guards the contract the Settings chooser relies on: it defaults to the seed
// default, accepts valid pool ids, ignores unknown ids, and always resolves to a
// real palette.

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import { DEFAULT_PALETTE_ID, PALETTE_POOL } from "@/lib/palettes"
import {
  $activePaletteId,
  getActivePalette,
  getActivePaletteId,
  initActivePalette,
  setActivePalette,
} from "@/stores/palette"

const POOL_IDS = PALETTE_POOL.palettes.map((p) => p.id)

beforeEach(() => {
  localStorage.clear()
  $activePaletteId.set(DEFAULT_PALETTE_ID)
})

afterEach(() => {
  $activePaletteId.set(DEFAULT_PALETTE_ID)
})

describe("active palette store", () => {
  test("defaults to the seed default palette", () => {
    expect(getActivePaletteId()).toBe(DEFAULT_PALETTE_ID)
    expect(getActivePalette().id).toBe(DEFAULT_PALETTE_ID)
  })

  test("updates and persists a valid palette id", () => {
    setActivePalette("paired")
    expect(getActivePaletteId()).toBe("paired")
    expect(getActivePalette().id).toBe("paired")
    expect($activePaletteId.get()).toBe("paired")
  })

  test("ignores unknown palette ids", () => {
    setActivePalette("paired")
    setActivePalette("does-not-exist")
    expect(getActivePaletteId()).toBe("paired")
  })

  test("always resolves to an id present in the pool", () => {
    for (const id of POOL_IDS) {
      setActivePalette(id)
      expect(POOL_IDS).toContain(getActivePaletteId())
    }
  })

  test("initActivePalette resets a stale persisted id to the default", () => {
    // The read helpers already fall back without writing; the bootstrap should
    // actually clear the invalid value from storage.
    $activePaletteId.set("removed-palette")
    initActivePalette()
    expect($activePaletteId.get()).toBe(DEFAULT_PALETTE_ID)
  })

  test("initActivePalette leaves a valid persisted id untouched", () => {
    $activePaletteId.set("paired")
    initActivePalette()
    expect($activePaletteId.get()).toBe("paired")
  })
})
