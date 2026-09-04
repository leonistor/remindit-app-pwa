// Feedback card (FB3): post bug/feature-request/discussion feedback to the
// community board (Apache Answer via the BFF) and request the "set your
// password" email that unlocks commenting there. Account-gated like
// shared-list-card / notifications-card — renders nothing while signed out.
// Self-contained: it talks to bffApi directly (one-shot account-level actions,
// not data-plane sync), pulling the session token the same way group-actions
// does ($syncSession.get()?.token).

import { useStore } from "@nanostores/react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { BffError, bffApi, type FeedbackTag } from "@/lib/bff-api"
import { m } from "@/paraglide/messages"
import { $syncSession } from "@/stores/sync"

// The board answers 503 ("feedback unavailable") and 502 ("answer rejected the
// question") when it can't accept feedback — both mean "try again later", so
// they share the dedicated message; any other failure is generic.
const feedbackSubmitError = (cause: unknown): string =>
  cause instanceof BffError &&
  (cause.status === 503 || cause.status === 502)
    ? m.feedbackErrorUnavailable()
    : m.feedbackErrorGeneric()

const FEEDBACK_TAGS: FeedbackTag[] = ["bug", "feature-request", "discussion"]

const tagLabel = (tag: FeedbackTag): string => {
  if (tag === "bug") return m.feedbackTagBug()
  if (tag === "feature-request") return m.feedbackTagFeatureRequest()
  return m.feedbackTagDiscussion()
}

export function FeedbackCard() {
  const session = useStore($syncSession)

  const [dialogOpen, setDialogOpen] = useState(false)
  // Form lifecycle: idle (form) → busy (posting) → done (success state).
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle")
  const [subject, setSubject] = useState("")
  const [text, setText] = useState("")
  const [tag, setTag] = useState<FeedbackTag>("bug")
  const [questionUrl, setQuestionUrl] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [loginBusy, setLoginBusy] = useState(false)
  const [loginMessage, setLoginMessage] = useState<"ok" | "error" | null>(null)

  if (!session) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Same accessor as group-actions.requireToken: pull the current token
    // from the store at call time (rotation may have updated it mid-session).
    const token = $syncSession.get()?.token
    if (!token) return
    setPhase("busy")
    setSubmitError(null)
    try {
      const res = await bffApi.submitFeedback(token, {
        subject: subject.trim(),
        text: text.trim(),
        tag,
        route: window.location.pathname,
      })
      setQuestionUrl(res.questionUrl)
      setSubject("")
      setText("")
      setPhase("done")
    } catch (cause) {
      setSubmitError(feedbackSubmitError(cause))
      setPhase("idle")
    }
  }

  const sendLogin = async () => {
    const token = $syncSession.get()?.token
    if (!token || loginBusy) return
    setLoginBusy(true)
    setLoginMessage(null)
    try {
      await bffApi.activateFeedbackLogin(token)
      setLoginMessage("ok")
    } catch {
      setLoginMessage("error")
    } finally {
      setLoginBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader
        title={m.feedbackTitle()}
        description={m.feedbackDescription()}
      />
      <CardContent className="flex flex-col gap-3">
        <Dialog
          open={dialogOpen}
          onOpenChange={(details) => {
            // Re-opening always starts at the form; closing clears the
            // transient success/error state so the next open is fresh.
            setDialogOpen(details.open)
            if (details.open) {
              setPhase("idle")
              setSubmitError(null)
            } else {
              setPhase("idle")
              setQuestionUrl(null)
              setSubmitError(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>{m.feedbackSendButton()}</Button>
          </DialogTrigger>
          <DialogContent>
            {phase === "done" && questionUrl ? (
              <>
                <DialogHeader
                  title={m.feedbackSuccessTitle()}
                  description={m.feedbackSuccessDescription()}
                />
                <DialogBody>
                  <Button asChild variant="outline">
                    <a
                      href={questionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.feedbackOpenQuestion()}
                    </a>
                  </Button>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{m.close()}</Button>
                  </DialogClose>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader
                  title={m.feedbackTitle()}
                  description={m.feedbackDescription()}
                />
                <form onSubmit={submit}>
                  <DialogBody className="flex flex-col gap-4">
                    <Field className="gap-3">
                      <FieldLabel htmlFor="feedback-subject">
                        {m.feedbackSubjectLabel()}
                      </FieldLabel>
                      <Input
                        id="feedback-subject"
                        value={subject}
                        placeholder={m.feedbackSubjectPlaceholder()}
                        disabled={phase === "busy"}
                        onChange={(event) => setSubject(event.target.value)}
                      />
                    </Field>
                    <Field className="gap-3">
                      <FieldLabel htmlFor="feedback-text">
                        {m.feedbackTextLabel()}
                      </FieldLabel>
                      <Textarea
                        id="feedback-text"
                        value={text}
                        placeholder={m.feedbackTextPlaceholder()}
                        disabled={phase === "busy"}
                        minLength={6}
                        onChange={(event) => setText(event.target.value)}
                      />
                    </Field>
                    <Field className="gap-3">
                      <FieldLabel>{m.feedbackTagLabel()}</FieldLabel>
                      <SegmentGroup
                        aria-label={m.feedbackTagLabel()}
                        className="w-full"
                        disabled={phase === "busy"}
                        value={tag}
                        onValueChange={(details) =>
                          setTag(
                            typeof details.value === "string"
                              ? (details.value as FeedbackTag)
                              : (details.value[0] as FeedbackTag)
                          )
                        }
                      >
                        {FEEDBACK_TAGS.map((option) => (
                          <SegmentGroupItem key={option} value={option}>
                            <SegmentGroupItemText>
                              {tagLabel(option)}
                            </SegmentGroupItemText>
                          </SegmentGroupItem>
                        ))}
                      </SegmentGroup>
                    </Field>
                    {submitError && (
                      <p className="text-destructive text-sm">{submitError}</p>
                    )}
                  </DialogBody>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{m.cancel()}</Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      isLoading={phase === "busy"}
                      disabled={
                        phase === "busy" || !subject.trim() || !text.trim()
                      }
                    >
                      {phase === "busy"
                        ? m.feedbackSubmitting()
                        : m.feedbackSubmitButton()}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>

        <p className="font-medium text-sm">{m.feedbackLoginTitle()}</p>
        <p className="text-muted-foreground text-sm">
          {m.feedbackLoginDescription()}
        </p>
        <Button
          variant="outline"
          onClick={() => void sendLogin()}
          isLoading={loginBusy}
          disabled={loginBusy}
        >
          {loginBusy ? m.feedbackLoginSending() : m.feedbackLoginButton()}
        </Button>
        {loginMessage === "ok" && (
          <p className="text-sm text-success">{m.feedbackLoginSuccess()}</p>
        )}
        {loginMessage === "error" && (
          <p className="text-destructive text-sm">{m.feedbackLoginError()}</p>
        )}
      </CardContent>
    </Card>
  )
}