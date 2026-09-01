import { useStore } from "@nanostores/react"
import { CheckCircle, DownloadSimple, Rows, Trash } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { DATASETS, DEFAULT_DATASET_ID } from "seed"
import { BackButton } from "@/components/back-button"
import { LanguageChooser } from "@/components/language-chooser"
import { PaletteChooser } from "@/components/palette-chooser"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@/components/ui/segment-group"
import { downloadLocalData, eraseLocalData } from "@/lib/local-data"
import { m } from "@/paraglide/messages"
import {
  $user,
  getUser,
  seedFromDataset,
  setSelectedDataset,
  updateUser,
} from "@/stores"

// First-run dataset (build-time) used as the default picker selection.
const INITIAL_DATASET = import.meta.env.PUBLIC_DATASET ?? DEFAULT_DATASET_ID

// How long the "reseeded" confirmation stays visible before the redirect to
// the main view — long enough to read one line, short enough to feel snappy.
const RESEED_ACK_MS = 1500

// The reseed dialog's lifecycle: idle (picker open) → busy (seeding runs) →
// done (confirmation shown, auto-redirect armed).
type ResetPhase = "idle" | "busy" | "done"

const ProfileView = () => {
  const user = useStore($user)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)
  const [dataset, setDataset] = useState<string>(INITIAL_DATASET)
  const [resetPhase, setResetPhase] = useState<ResetPhase>("idle")
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
  })

  // Re-sync the form when the stored profile changes externally.
  useEffect(() => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    })
  }, [user.firstName, user.lastName, user.username])

  const saveProfile = () => {
    const username = form.username.trim()
    if (!username) return
    updateUser({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username,
    })
  }

  const handleReset = () => {
    if (resetPhase !== "idle") return
    setResetPhase("busy")
    // seedFromDataset is one long synchronous block (wipe + fresh 6-month
    // history generation); defer it a frame so the busy state actually paints
    // before the main thread freezes for the work.
    window.setTimeout(() => {
      // Reseed catalog/history/list from the chosen dataset, keeping the
      // current profile. Theme preference is preserved inside seedFromDataset.
      seedFromDataset(dataset, getUser())
      setSelectedDataset(dataset)
      setResetPhase("done")
      // Let the confirmation land, then take the user to the fresh list —
      // the visible "it worked" moment instead of a silent in-place swap.
      window.setTimeout(() => {
        setOpen(false)
        setResetPhase("idle")
        navigate("/")
      }, RESEED_ACK_MS)
    }, 50)
  }

  const handleErase = () => {
    // Full wipe — including theme — then let the onboarding guard redirect.
    eraseLocalData()
    setEraseOpen(false)
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="font-bold text-2xl">Profile</h1>
      </div>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="Your details"
          description="Update how you appear in RemindIt. The username is required."
        />
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                alt="Your avatar"
                className="size-16 rounded-full border"
                src={user.avatar}
              />
            ) : null}
            <p className="text-muted-foreground text-sm">
              Avatar editing is coming later.
            </p>
          </div>

          <Field className="gap-3">
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </Field>

          <Field className="gap-3">
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
            />
          </Field>

          <Field className="gap-3">
            <FieldLabel htmlFor="username">Username *</FieldLabel>
            <Input
              id="username"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
            />
          </Field>
        </CardContent>
        <CardFooter>
          <Button onClick={saveProfile} disabled={!form.username.trim()}>
            Save changes
          </Button>
        </CardFooter>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="Catalog"
          description="Manage the items and categories in your catalog."
        />
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/catalog">
              <Rows size={16} />
              Open catalog
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="Color palette"
          description="Choose how categories and items are colored across the app. Your pick is saved and applies everywhere."
        />
        <CardContent>
          <PaletteChooser />
        </CardContent>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader title={m.language()} description={m.languageSwitchHint()} />
        <CardContent>
          <LanguageChooser />
        </CardContent>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="My local data"
          description="Download a copy of your data or erase everything stored in this browser."
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Download saves a JSON file with all your lists, catalog, history,
            and preferences. Erase removes everything — including theme — and
            sends you back to onboarding.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={downloadLocalData}>
            <DownloadSimple size={16} />
            Download
          </Button>
          <AlertDialog
            open={eraseOpen}
            onOpenChange={(d) => setEraseOpen(d.open)}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash size={16} />
                Erase
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader
                title="Erase all local data?"
                description="This cannot be undone. All lists, history, catalog, and preferences will be removed and you will be sent back to onboarding."
              />
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => setEraseOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleErase}>
                  Erase
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title="Reset & reseed"
          description="Replace all local data with a fresh catalog from the selected dataset."
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            This wipes your shopping list, history, and catalog, then reseeds
            from the chosen dataset. Your profile and theme preference are kept.
          </p>
        </CardContent>
        <CardFooter>
          <Dialog
            open={open}
            onOpenChange={(details) => {
              // Lock the dialog while the reseed runs (ESC/overlay can't
              // abandon a half-done wipe); re-opening always starts clean.
              if (!details.open && resetPhase !== "idle") return
              setOpen(details.open)
              if (details.open) setResetPhase("idle")
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive">Reset app & reseed</Button>
            </DialogTrigger>
            <DialogContent>
              {resetPhase === "done" ? (
                <>
                  <DialogHeader
                    title="Catalog reseeded"
                    description={`Replaced your catalog from "${
                      DATASETS.find((d) => d.id === dataset)?.name ?? dataset
                    }".`}
                  />
                  <DialogBody>
                    <p
                      className="flex items-center gap-2 text-sm text-success"
                      role="status"
                    >
                      <CheckCircle size={18} weight="fill" />
                      Taking you to your shopping list…
                    </p>
                  </DialogBody>
                </>
              ) : (
                <>
                  <DialogHeader
                    title="Reset app and reseed?"
                    description="This cannot be undone. Choose which dataset to seed from."
                  />
                  <DialogBody>
                    <SegmentGroup
                      aria-label="Seed dataset"
                      className="w-full"
                      disabled={resetPhase === "busy"}
                      value={dataset}
                      onValueChange={(details) =>
                        setDataset(
                          typeof details.value === "string"
                            ? details.value
                            : (details.value[0] ?? DEFAULT_DATASET_ID)
                        )
                      }
                    >
                      {DATASETS.map((d) => (
                        <SegmentGroupItem key={d.id} value={d.id}>
                          <SegmentGroupItemText>{d.name}</SegmentGroupItemText>
                        </SegmentGroupItem>
                      ))}
                    </SegmentGroup>
                  </DialogBody>
                  <DialogFooter>
                    {resetPhase === "idle" && (
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleReset}
                      isLoading={resetPhase === "busy"}
                      disabled={resetPhase === "busy"}
                    >
                      {resetPhase === "busy" ? "Reseeding…" : "Reset & reseed"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProfileView
