import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/custom/button"
import type { ManualInstallPlatform } from "@/stores/pwa-install"

const INSTRUCTIONS: Record<
  ManualInstallPlatform,
  { title: string; steps: string[] }
> = {
  ios: {
    title: "Add to your iPhone or iPad",
    steps: [
      'Tap the Share button (the square with an arrow) in Safari.',
      'Scroll down and tap "Add to Home Screen".',
      'Tap Add in the top-right to confirm.',
    ],
  },
  "mac-safari": {
    title: "Add to your Mac",
    steps: [
      'In Safari, choose File ▸ "Add to Dock", or open the Share menu.',
      "Confirm Remindit to add it to your Dock.",
    ],
  },
  "android-nonchrome": {
    title: "Add to your Android device",
    steps: [
      'Open your browser menu (the three-dot or three-line icon).',
      'Tap "Install app" or "Add to Home screen".',
      "Confirm to install Remindit.",
    ],
  },
  other: {
    title: "Install Remindit",
    steps: [
      'Open your browser menu (usually top-right).',
      'Choose "Install Remindit" or "Add to Home screen".',
      "Confirm to install.",
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
    <Dialog
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <DialogContent>
        <DialogHeader
          description="Remindit works best installed, with offline access from your home screen or dock."
          title={title}
        />
        <DialogBody>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
