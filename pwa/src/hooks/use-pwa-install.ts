import { useStore } from "@nanostores/react"
import type { ManualInstallPlatform } from "@/lib/pwa-install"
import {
  $canInstall,
  $installDismissed,
  $installed,
  $manualPlatform,
  $showInstallBanner,
  dismissInstall,
  dismissLater,
  installApp,
} from "@/stores/pwa-install"

export interface UsePwaInstall {
  canInstall: boolean
  installed: boolean
  dismissed: boolean
  platform: ManualInstallPlatform
  showBanner: boolean
  installApp: () => Promise<boolean>
  dismissInstall: () => void
  dismissLater: () => void
}

// Feature hook over the PWA-install atoms. Lives in @/hooks (not @/stores) so
// the stores barrel never re-exports React hooks — see docs/DEV.md on the
// hooks-home convention.
export function usePwaInstall(): UsePwaInstall {
  const canInstall = useStore($canInstall)
  const installed = useStore($installed)
  const dismissed = useStore($installDismissed)
  const platform = useStore($manualPlatform)
  const showBanner = useStore($showInstallBanner)

  return {
    canInstall,
    installed,
    dismissed,
    platform,
    showBanner,
    installApp,
    dismissInstall,
    dismissLater,
  }
}
