// FNV-1a 32-bit hash → zero-padded 8-char hex string.
//
// Shared by the seed loader (`seed/index.ts`) and the history generator
// (`seed/history.ts`) so every generated id is stable and reproducible. The
// scheme is copied byte-for-byte from `tests/fixtures/history.ts` so existing
// test fixtures and the app keep producing the same category/item ids.

export function hashId(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
