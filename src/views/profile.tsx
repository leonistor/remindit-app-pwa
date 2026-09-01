import { useStore } from "@nanostores/react"
import { CheckCircle, DownloadSimple, Rows, Trash } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { DATASETS, DEFAULT_DATASET_ID } from "seed"
import { BackButton } from "@/components/back-button"
import { AvatarPicker } from "@/components/avatar-picker"
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
        <h1 className="font-bold text-2xl">{m.profileTitle()}</h1>
      </div>

      <Card className="w-full max-w-xl">
        <CardHeader
          title={m.profileDetailsTitle()}
          description={m.profileDetailsDescription()}
        />
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {user.avatar ? <AvatarPicker avatar={user.avatar} /> : null}
            <p className="text-muted-foreground text-sm">
              {m.profileAvatarHint()}
            </p>
          </div>

          <Field className="gap-3">
            <FieldLabel htmlFor="firstName">
              {m.profileFirstNameLabel()}
            </FieldLabel>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </Field>

          <Field className="gap-3">
            <FieldLabel htmlFor="lastName">
              {m.profileLastNameLabel()}
            </FieldLabel>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
            />
          </Field>

          <Field className="gap-3">
            <FieldLabel htmlFor="username">
              {m.profileUsernameLabel()}
            </FieldLabel>
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
            {m.profileSaveChanges()}
          </Button>
        </CardFooter>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title={m.profileCatalogTitle()}
          description={m.profileCatalogDescription()}
        />
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/catalog">
              <Rows size={16} />
              {m.profileOpenCatalog()}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title={m.profilePaletteTitle()}
          description={m.profilePaletteDescription()}
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
          title={m.profileLocalDataTitle()}
          description={m.profileLocalDataDescription()}
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {m.profileLocalDataHint()}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={downloadLocalData}>
            <DownloadSimple size={16} />
            {m.profileDownloadButton()}
          </Button>
          <AlertDialog
            open={eraseOpen}
            onOpenChange={(d) => setEraseOpen(d.open)}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash size={16} />
                {m.profileEraseButton()}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader
                title={m.profileEraseTitle()}
                description={m.profileEraseDescription()}
              />
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => setEraseOpen(false)}>
                  {m.cancel()}
                </Button>
                <Button variant="destructive" onClick={handleErase}>
                  {m.profileEraseButton()}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      <Card className="w-full max-w-xl">
        <CardHeader
          title={m.profileResetTitle()}
          description={m.profileResetDescription()}
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {m.profileResetHint()}
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
              <Button variant="destructive">{m.profileResetButton()}</Button>
            </DialogTrigger>
            <DialogContent>
              {resetPhase === "done" ? (
                <>
                  <DialogHeader
                    title={m.profileReseededTitle()}
                    description={m.profileReseededDescription({
                      datasetName:
                        DATASETS.find((d) => d.id === dataset)?.name ?? dataset,
                    })}
                  />
                  <DialogBody>
                    <p
                      className="flex items-center gap-2 text-sm text-success"
                      role="status"
                    >
                      <CheckCircle size={18} weight="fill" />
                      {m.profileReseededRedirect()}
                    </p>
                  </DialogBody>
                </>
              ) : (
                <>
                  <DialogHeader
                    title={m.profileResetConfirmTitle()}
                    description={m.profileResetConfirmDescription()}
                  />
                  <DialogBody>
                    <SegmentGroup
                      aria-label={m.seedDatasetLabel()}
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
                        <Button variant="outline">{m.cancel()}</Button>
                      </DialogClose>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleReset}
                      isLoading={resetPhase === "busy"}
                      disabled={resetPhase === "busy"}
                    >
                      {resetPhase === "busy"
                        ? m.profileReseeding()
                        : m.profileResetConfirmButton()}
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
