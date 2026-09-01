import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import type { ManualInstallPlatform } from "@/lib/pwa-install"
import { m } from "@/paraglide/messages"

// Titles and steps resolve lazily (inside component render) so they follow
// the active locale instead of freezing at import time.
const INSTRUCTIONS: Record<
  ManualInstallPlatform,
  { title: () => string; steps: () => string[] }
> = {
  ios: {
    title: () => m.installIosTitle(),
    steps: () => [
      m.installIosStep1(),
      m.installIosStep2(),
      m.installIosStep3(),
    ],
  },
  "mac-safari": {
    title: () => m.installMacTitle(),
    steps: () => [m.installMacStep1(), m.installMacStep2()],
  },
  "android-nonchrome": {
    title: () => m.installAndroidTitle(),
    steps: () => [
      m.installAndroidStep1(),
      m.installAndroidStep2(),
      m.installAndroidStep3(),
    ],
  },
  other: {
    title: () => m.installRemindit(),
    steps: () => [
      m.installOtherStep1(),
      m.installOtherStep2(),
      m.installOtherStep3(),
    ],
  },
}

interface InstallInstructionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: ManualInstallPlatform
}

// Manual "Add to Home Screen" steps for browsers that don't expose a native
// install prompt (Safari/iOS, macOS Safari, Android non-Chrome).
export function InstallInstructionsDialog({
  open,
  onOpenChange,
  platform,
}: InstallInstructionsDialogProps) {
  const { title, steps } = INSTRUCTIONS[platform]

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent>
        <DialogHeader
          description={m.installInstructionsDescription()}
          title={title()}
        />
        <DialogBody>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {steps().map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{m.close()}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
