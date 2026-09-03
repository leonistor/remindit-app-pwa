import { ArrowLeft } from "@phosphor-icons/react"
import { useLocation, useNavigate } from "react-router"
import { Button } from "@/components/ui/custom/button"
import { m } from "@/paraglide/messages"

/**
 * In-app back control for iOS standalone mode, which lacks a system back button.
 * Falls back to the home route when there is no in-app history (e.g. a cold
 * deep link) so we never navigate out of the PWA.
 */
export function BackButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const goBack = () => {
    if (location.key === "default") navigate("/")
    else navigate(-1)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={m.back()}
      onClick={goBack}
      className={className}
    >
      <ArrowLeft size={20} aria-hidden />
    </Button>
  )
}
