import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@/components/ui/segment-group"
import { APP_LOCALES, getActiveLocale, setAppLocale } from "@/lib/locale"
import { m } from "@/paraglide/messages"

/**
 * Language picker shared by the onboarding language step (first step) and the
 * Profile language card. Selecting a locale persists it via the Paraglide
 * strategy and reloads the document in the new language (see
 * docs/I18N-PLAN.md) — so the active locale is read non-reactively here: after
 * a switch the whole document re-renders anyway.
 */
const LanguageChooser = ({ className = "w-full" }: { className?: string }) => (
  <SegmentGroup
    aria-label={m.language()}
    className={className}
    value={getActiveLocale()}
    onValueChange={(details) => {
      const value = Array.isArray(details.value)
        ? details.value[0]
        : details.value
      const locale = APP_LOCALES.find((l) => l.code === value)?.code
      if (locale) setAppLocale(locale)
    }}
  >
    {APP_LOCALES.map((locale) => (
      <SegmentGroupItem key={locale.code} value={locale.code}>
        <SegmentGroupItemText>{locale.nativeName}</SegmentGroupItemText>
      </SegmentGroupItem>
    ))}
  </SegmentGroup>
)

export { LanguageChooser }
