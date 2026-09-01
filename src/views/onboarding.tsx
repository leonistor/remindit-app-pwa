import { useStore } from "@nanostores/react"
import { DiceFive, User } from "@phosphor-icons/react"
import { type FocusEvent, type MouseEvent, useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router"
import { DATASETS, DEFAULT_DATASET_ID } from "seed"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/custom/button"
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
import { generateRandomProfile } from "@/lib/profile-generator"
import { $onboarded, completeOnboarding } from "@/stores"
import type { UserProfile } from "@/stores/types"

const EMPTY_PROFILE: UserProfile = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

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

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
  const [dataset, setDataset] = useState<string>(DEFAULT_DATASET_ID)
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader title="Welcome to RemindIt" />
        <CardContent>
          {/* Ark's controlled prop is `step` (0-based) in this version —
              `value` would leak to the DOM and never update the machine. */}
          <Steps className="mb-6" count={3} step={step - 1}>
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
              </StepsItem>
            </StepsList>
          </Steps>
          {step === 1 ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-center text-muted-foreground text-sm">
                Here's a quick look at adding items — then two short steps and
                you're in.
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
            </div>
          ) : step === 2 ? (
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-3">
                {profile.avatar ? (
                  <img
                    alt="Avatar preview"
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
                  aria-label="Roll a new random name and avatar"
                >
                  <DiceFive size={28} />
                </Button>
                <span className="text-muted-foreground text-xs">
                  Not feeling it? Roll again.
                </span>
              </div>

              <Field className="gap-3">
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
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
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
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
                <FieldLabel htmlFor="username">Username *</FieldLabel>
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
                Pick a starter catalog. You can switch or reseed later from
                Profile.
              </p>
              <SegmentGroup
                aria-label="Seed dataset"
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
              steps 2/3, where Back occupies the left side. */}
          {step === 1 ? (
            <span aria-hidden />
          ) : (
            <Button
              type="button"
              variant="outline"
              // step - 1 widens to number; only steps 2/3 render Back.
              onClick={() => setStep(step === 3 ? 2 : 1)}
            >
              Back
            </Button>
          )}
          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)}>
              Next
            </Button>
          ) : null}
          {step === 2 ? (
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={busy || !profile.username.trim()}
            >
              Next
            </Button>
          ) : null}
          {step === 3 ? (
            <Button type="button" onClick={finish} disabled={busy}>
              <User size={16} />
              Finish
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  )
}

export default OnboardingView
