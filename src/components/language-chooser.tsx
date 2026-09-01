import { Check } from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import { APP_LOCALES, getActiveLocale, setAppLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"
import { m } from "@/paraglide/messages"

/**
 * Language picker shared by the onboarding language step (first step) and the
 * Profile language card. A vertical stack of secondary buttons — scales to any
 * number of locales (DE/FR/UK are next). The active locale carries
 * `aria-pressed` + a check mark; selecting persists via the Paraglide strategy
 * and reloads the document in the new language (see docs/I18N-PLAN.md), so the
 * active locale is read non-reactively: after a switch the whole document
 * re-renders anyway.
 */
const LanguageChooser = ({ className = "w-full" }: { className?: string }) => {
  const active = getActiveLocale()
  return (
    <fieldset
      aria-label={m.language()}
      className={cn("m-0 flex flex-col gap-2 border-0 p-0", className)}
    >
      {APP_LOCALES.map((locale) => {
        const isActive = locale.code === active
        return (
          <Button
            aria-pressed={isActive}
            key={locale.code}
            onClick={() => setAppLocale(locale.code)}
            type="button"
            variant="secondary"
          >
            {locale.nativeName}
            {isActive ? <Check size={16} weight="bold" /> : null}
          </Button>
        )
      })}
    </fieldset>
  )
}

export { LanguageChooser }
