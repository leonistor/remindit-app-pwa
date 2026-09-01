import { useStore } from "@nanostores/react"
import { DiceFive, UploadSimple, User, Warning } from "@phosphor-icons/react"
import {
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { Navigate, useNavigate } from "react-router"
import { DATASETS, DEFAULT_DATASET_ID } from "seed"
import { LanguageChooser } from "@/components/language-chooser"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@/components/ui/segment-group"
import {
  Steps,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsSeparator,
} from "@/components/ui/steps"
import {
  formatExportedAt,
  type LocalDataEnvelope,
  readLocalDataFile,
} from "@/lib/local-data"
import { generateRandomProfile } from "@/lib/profile-generator"
import { m } from "@/paraglide/messages"
import { $onboarded, completeOnboarding, restoreLocalData } from "@/stores"
import type { UserProfile } from "@/stores/types"

const EMPTY_PROFILE: UserProfile = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

// The backup-restore flow's lifecycle: idle (nothing picked) → confirm
// (dialog open with a parsed envelope) → busy (restoreLocalData running).
type RestorePhase = "idle" | "confirm" | "busy"

// Tracks inputs that got a fresh focus so `keepSelectionOnClick` only suppresses
// the single mouseup that ends a click-focus (which would otherwise collapse the
// selection to the cursor), leaving later clicks free to position the caret.
const selectionProtected = new WeakSet<HTMLElement>()

// Select the pre-filled value on focus so typing replaces it in one go.
// Keyboard focus works via `.select()` alone; see `keepSelectionOnClick` for the
// mouse-click path.
const selectAllOnFocus = (e: FocusEvent<HTMLInputElement>) => {
  const input = e.currentTarget
  input.select()
  selectionProtected.add(input)
}

const keepSelectionOnClick = (e: MouseEvent<HTMLInputElement>) => {
  const input = e.currentTarget
  if (selectionProtected.delete(input)) e.preventDefault()
}

const clearSelectionProtection = (e: FocusEvent<HTMLInputElement>) => {
  selectionProtected.delete(e.currentTarget)
}

const profileInputProps = {
  onFocus: selectAllOnFocus,
  onMouseUp: keepSelectionOnClick,
  onBlur: clearSelectionProtection,
}

const OnboardingView = () => {
  const navigate = useNavigate()
  const onboarded = useStore($onboarded)

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
  const [dataset, setDataset] = useState<string>(DEFAULT_DATASET_ID)
  const [busy, setBusy] = useState(false)
  const [restorePhase, setRestorePhase] = useState<RestorePhase>("idle")
  const [pendingEnvelope, setPendingEnvelope] =
    useState<LocalDataEnvelope | null>(null)
  const [restoreError, setRestoreError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // React does not reliably render the `muted` ATTRIBUTE (it only sets the DOM
  // property), and some browsers ignore property-only muting for autoplay
  // policy — enforce it on mount so autoplay isn't blocked.
  const welcomeVideoRef = (v: HTMLVideoElement | null) => {
    if (v) v.muted = true
  }

  // Generate the initial suggested profile on first mount.
  useEffect(() => {
    let active = true
    setBusy(true)
    generateRandomProfile()
      .then((p) => active && setProfile(p))
      .finally(() => active && setBusy(false))
    return () => {
      active = false
    }
  }, [])

  // Already onboarded (e.g. direct nav) → go home.
  if (onboarded) return <Navigate to="/" replace />

  const roll = () => {
    setBusy(true)
    generateRandomProfile()
      .then(setProfile)
      .finally(() => setBusy(false))
  }

  const finish = () => {
    const finalProfile: UserProfile = {
      ...profile,
      username: profile.username.trim(),
    }
    if (!finalProfile.username) return
    completeOnboarding(finalProfile, dataset)
    navigate("/")
  }

  const onRestoreFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so re-picking the same file fires onChange again.
    e.target.value = ""
    if (!file) return
    setRestoreError(false)
    try {
      const envelope = await readLocalDataFile(file)
      setPendingEnvelope(envelope)
      setRestorePhase("confirm")
    } catch {
      setRestoreError(true)
    }
  }

  const confirmRestore = () => {
    if (restorePhase !== "confirm" || !pendingEnvelope) return
    const envelope = pendingEnvelope
    setRestorePhase("busy")
    // restoreLocalData is one long synchronous block (sets all 12 stores);
    // defer a tick so the busy state actually paints before the main thread
    // freezes for the work.
    window.setTimeout(() => {
      restoreLocalData(envelope)
      setPendingEnvelope(null)
      setRestorePhase("idle")
      // The wizard's own profile/dataset/step state is deliberately untouched:
      // the restore abandons steps 3–4, and $onboarded now routes home anyway.
      navigate("/")
    }, 50)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader title={m.onboardingWelcomeTitle()} />
        <CardContent>
          {/* Ark's controlled prop is `step` (0-based) in this version —
              `value` would leak to the DOM and never update the machine. */}
          <Steps className="mb-6" count={4} step={step - 1}>
            <StepsList className="w-full">
              <StepsItem index={0}>
                <StepsIndicator>1</StepsIndicator>
                <StepsSeparator />
              </StepsItem>
              <StepsItem index={1}>
                <StepsIndicator>2</StepsIndicator>
                <StepsSeparator />
              </StepsItem>
              <StepsItem index={2}>
                <StepsIndicator>3</StepsIndicator>
                <StepsSeparator />
              </StepsItem>
              <StepsItem index={3}>
                <StepsIndicator>4</StepsIndicator>
              </StepsItem>
            </StepsList>
          </Steps>
          {step === 1 ? (
            <div className="flex flex-col items-center gap-6">
              {/* Bilingual by design: the user may not read the default locale
                  yet, so both self-labels render regardless of active locale. */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-center text-muted-foreground text-sm">
                  {m.chooseYourLanguageEn()}
                </p>
                <p className="text-center text-muted-foreground text-sm">
                  {m.chooseYourLanguageRo()}
                </p>
              </div>
              <LanguageChooser className="w-full max-w-xs" />
            </div>
          ) : step === 2 ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-center text-muted-foreground text-sm">
                {m.onboardingVideoIntro()}
              </p>
              <video
                ref={welcomeVideoRef}
                src="/demos/00-welcome-light.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="mx-auto max-h-96 w-auto rounded-lg border bg-white"
              />
              <div className="flex flex-col items-center gap-2">
                <p className="text-center text-muted-foreground text-sm">
                  {m.onboardingRestoreBackupHint()}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadSimple size={16} />
                  {m.onboardingRestoreBackupButton()}
                </Button>
                {restoreError ? (
                  <p
                    className="text-center text-destructive text-sm"
                    role="alert"
                  >
                    {m.importBackupInvalidFile()}
                  </p>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={onRestoreFilePicked}
              />
              <Dialog
                open={restorePhase !== "idle"}
                onOpenChange={(details) => {
                  // Lock dismissal while the restore runs; closing discards
                  // the pending envelope so a re-open starts the flow fresh.
                  if (!details.open && restorePhase === "busy") return
                  setRestorePhase(details.open ? "confirm" : "idle")
                  if (!details.open) setPendingEnvelope(null)
                }}
              >
                <DialogContent>
                  {pendingEnvelope ? (
                    <>
                      <DialogHeader
                        title={m.importBackupTitle()}
                        description={m.importBackupDescription({
                          appVersion: pendingEnvelope.version,
                          exportedAt: formatExportedAt(
                            pendingEnvelope.exportedAt
                          ),
                        })}
                      />
                      <DialogBody>
                        <p className="flex items-center gap-2 text-destructive text-sm">
                          <Warning size={18} weight="fill" />
                          {m.importBackupWarning()}
                        </p>
                      </DialogBody>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">
                            {m.cancel()}
                          </Button>
                        </DialogClose>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={confirmRestore}
                          isLoading={restorePhase === "busy"}
                          disabled={restorePhase === "busy"}
                        >
                          {m.importBackupConfirmButton()}
                        </Button>
                      </DialogFooter>
                    </>
                  ) : null}
                </DialogContent>
              </Dialog>
            </div>
          ) : step === 3 ? (
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-3">
                {profile.avatar ? (
                  <img
                    alt={m.onboardingAvatarAlt()}
                    className="size-24 rounded-full border"
                    src={profile.avatar}
                  />
                ) : (
                  <div className="size-24 animate-pulse rounded-full bg-muted" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xl"
                  onClick={roll}
                  disabled={busy}
                  aria-label={m.onboardingRollProfileLabel()}
                >
                  <DiceFive size={28} />
                </Button>
                <span className="text-muted-foreground text-xs">
                  {m.onboardingRollHint()}
                </span>
              </div>

              <Field className="gap-3">
                <FieldLabel htmlFor="firstName">
                  {m.onboardingFirstNameLabel()}
                </FieldLabel>
                <Input
                  id="firstName"
                  value={profile.firstName}
                  disabled={busy}
                  {...profileInputProps}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, firstName: e.target.value }))
                  }
                />
              </Field>

              <Field className="gap-3">
                <FieldLabel htmlFor="lastName">
                  {m.onboardingLastNameLabel()}
                </FieldLabel>
                <Input
                  id="lastName"
                  value={profile.lastName}
                  disabled={busy}
                  {...profileInputProps}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, lastName: e.target.value }))
                  }
                />
              </Field>

              <Field className="gap-3">
                <FieldLabel htmlFor="username">
                  {m.onboardingUsernameLabel()}
                </FieldLabel>
                <Input
                  id="username"
                  value={profile.username}
                  disabled={busy}
                  {...profileInputProps}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, username: e.target.value }))
                  }
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {m.onboardingDatasetHint()}
              </p>
              <SegmentGroup
                aria-label={m.seedDatasetLabel()}
                className="w-full"
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
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          {/* Step 1 renders an empty left slot so Next aligns right like on
              steps 2–4, where Back occupies the left side. */}
          {step === 1 ? (
            <span aria-hidden />
          ) : (
            <Button
              type="button"
              variant="outline"
              // Back renders only for steps 2–4, so step - 1 is always a valid
              // literal; the cast satisfies the narrowed state union.
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              {m.back()}
            </Button>
          )}
          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)}>
              {m.next()}
            </Button>
          ) : null}
          {step === 2 ? (
            <Button type="button" onClick={() => setStep(3)}>
              {m.next()}
            </Button>
          ) : null}
          {step === 3 ? (
            <Button
              type="button"
              onClick={() => setStep(4)}
              disabled={busy || !profile.username.trim()}
            >
              {m.next()}
            </Button>
          ) : null}
          {step === 4 ? (
            <Button type="button" onClick={finish} disabled={busy}>
              <User size={16} />
              {m.finish()}
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  )
}

export default OnboardingView
