// FNV-1a 32-bit hash → zero-padded 8-char hex string.
//
// Byte-for-byte copy of the pwa scheme (`pwa/seed/hash.ts`) so platform-seeded
// teams produce the SAME category/item local ids the pwa itself generates for
// its own catalogs. A fresh pwa joining a seeded group therefore reconciles
// with identical ids — no duplicate rows, clean sync demo.

export function hashId(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}