// Canonical + hreflang link helpers for the per-locale routes.
//
// Each route's `head()` derives its SEO links from `match.pathname`. The path
// is de-localized to the logical path, then re-localized per locale — en stays
// unprefixed (`/features`), the others get `/ro|de|fr|uk` prefixes. The origin
// comes from `window.location` on the client and from the request origin (set
// per-request by `src/server.ts`) on the server — `canonical.ts` never imports
// a server-only package so it stays client-safe.
import {
  baseLocale,
  deLocalizeUrl,
  localizeUrl,
  locales,
  type Locale,
} from "../paraglide/runtime"

export type AlternateLink = { hrefLang: string; href: string }

export type CanonicalLinks = {
  canonical: string
  alternates: AlternateLink[]
}

// Set by `src/server.ts` at the start of each request (the server bundle can
// read the request; this module must not, or the client build breaks).
declare global {
  var __REMINDIT_ORIGIN__: string | undefined
}

/** Absolute origin for the current request (server) or page (client). */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin
  return globalThis.__REMINDIT_ORIGIN__ ?? "http://localhost"
}

/** Canonical URL (current locale) + `<link rel="alternate">` hreflang set. */
export function canonicalLinks(href: string, origin = getSiteOrigin()): CanonicalLinks {
  const logical = deLocalizeUrl(new URL(href, origin))
  const alternates: AlternateLink[] = locales.map((locale: Locale) => ({
    // React prop — rendered as the hreflang attribute on <link rel="alternate">.
    hrefLang: locale,
    href: localizeUrl(logical, { locale }).href,
  }))
  // x-default points at the baseLocale (en, unprefixed) per
  // https://developers.google.com/search/docs/specialty/international/localized-versions
  alternates.push({
    hrefLang: "x-default",
    href: localizeUrl(logical, { locale: baseLocale }).href,
  })
  return { canonical: localizeUrl(logical).href, alternates }
}

/** Ready-to-return `links` array for a route's `head()`. */
export function canonicalLinkTags(href: string, origin = getSiteOrigin()) {
  const { canonical, alternates } = canonicalLinks(href, origin)
  // The alternate-locale attr is `hreflang` in HTML but React's camelCase prop
  // (server passes lowercase through to renderToString; client React warns on
  // `hreflang`, so use `hrefLang` there — both produce the same DOM attribute,
  // keeping SSR and hydration in agreement).
  const altKey = typeof window === "undefined" ? "hreflang" : "hrefLang"
  return [
    { rel: "canonical", href: canonical },
    ...alternates.map(({ hrefLang, href }) => ({ rel: "alternate", [altKey]: hrefLang, href })),
  ]
}