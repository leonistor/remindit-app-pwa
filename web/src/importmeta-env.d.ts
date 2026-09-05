// Rsbuild inlines `PUBLIC_*` env vars at build time via `import.meta.env`.
// The project's tsconfig does not ship Rsbuild client types, so we declare
// the shape here (mirrors pwa/src/stores/index.ts §ImportMeta).
declare global {
  interface ImportMeta {
    env?: {
      DEV?: boolean
      PROD?: boolean
      MODE?: string
      PUBLIC_BFF_URL?: string
      PUBLIC_PWA_URL?: string
      [key: string]: unknown
    }
  }
}

export {}
