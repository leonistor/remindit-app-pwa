import { BRAND_NAME } from "@remindit/common/brand"
import { createFileRoute } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { m } from "../paraglide/messages"

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: `${m.feedbackSendButton()} — ${BRAND_NAME}` },
      {
        name: "description",
        content: m.webFeedbackMetaDescription({ brandName: BRAND_NAME }),
      },
    ],
  }),
  component: Feedback,
})

type FeedbackTag = "bug" | "feature-request" | "discussion"

function Feedback() {
  // The form posts to the BFF's public guest endpoint. Env-driven (D9) like
  // PUBLIC_PWA_URL: unset at deploy ⇒ render a "not configured" note instead
  // of a form whose submits would hit a broken URL.
  const bffUrl = import.meta.env?.PUBLIC_BFF_URL

  return (
    <main className="container">
      <section className="section">
        {bffUrl ? (
          <FeedbackForm bffUrl={bffUrl} />
        ) : (
          <>
            <h2>{m.feedbackSendButton()}</h2>
            <p>{m.webFeedbackNotConfigured()}</p>
          </>
        )}
      </section>
    </main>
  )
}

const TAGS = [
  { value: "bug", label: () => m.feedbackTagBug() },
  { value: "feature-request", label: () => m.feedbackTagFeatureRequest() },
  { value: "discussion", label: () => m.feedbackTagDiscussion() },
] as const satisfies ReadonlyArray<{
  value: FeedbackTag
  label: () => string
}>

function FeedbackForm({ bffUrl }: Readonly<{ bffUrl: string }>) {
  const [subject, setSubject] = useState("")
  const [details, setDetails] = useState("")
  const [tag, setTag] = useState<FeedbackTag>("bug")
  const [contactEmail, setContactEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [questionUrl, setQuestionUrl] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const trimmedSubject = subject.trim()
    const trimmedDetails = details.trim()
    // Client-side mirror of the BFF's subject/text constraints — native
    // minLength/required already block submission, this is belt-and-braces.
    if (trimmedSubject.length < 6 || trimmedDetails.length === 0) {
      setError(m.webFeedbackValidationError())
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${bffUrl}/api/feedback/guest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: trimmedSubject,
          text: trimmedDetails,
          tag,
          ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        }),
      })
      // 400 = BFF validation; 502/503 = Answer board down/unavailable. Both
      // are the "board is having a moment" family for a guest form.
      if (res.status === 400) {
        setError(m.webFeedbackInvalidFields())
        return
      }
      if (res.status === 502 || res.status === 503) {
        setError(m.webFeedbackUnavailable())
        return
      }
      if (!res.ok) {
        setError(m.webFeedbackGenericError())
        return
      }
      const data = (await res.json()) as { questionUrl?: unknown }
      setQuestionUrl(
        typeof data.questionUrl === "string" ? data.questionUrl : null
      )
    } catch {
      setError(m.webFeedbackGenericError())
    } finally {
      setSubmitting(false)
    }
  }

  if (questionUrl) {
    return (
      <>
        <h2>{m.webFeedbackThanksTitle()}</h2>
        <p>{m.webFeedbackThanksBody()}</p>
        <p>
          <a
            className="cta"
            href={questionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m.webFeedbackViewQuestion()}
          </a>
        </p>
      </>
    )
  }

  return (
    <>
      <h2>{m.feedbackSendButton()}</h2>
      <p>{m.webFeedbackIntro()}</p>
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="feedback-subject">{m.feedbackSubjectLabel()}</label>
          <input
            id="feedback-subject"
            type="text"
            required
            minLength={6}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="feedback-details">{m.feedbackTextLabel()}</label>
          <textarea
            id="feedback-details"
            required
            minLength={6}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={m.webFeedbackTextPlaceholder()}
          />
        </div>
        <div className="field">
          <label htmlFor="feedback-tag">{m.feedbackTagLabel()}</label>
          <select
            id="feedback-tag"
            value={tag}
            onChange={(event) => setTag(event.target.value as FeedbackTag)}
          >
            {TAGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="feedback-email">{m.webFeedbackEmailLabel()}</label>
          <input
            id="feedback-email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder={m.webFeedbackEmailPlaceholder()}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="cta" type="submit" disabled={submitting}>
          {submitting ? m.webFeedbackSending() : m.feedbackSendButton()}
        </button>
      </form>
    </>
  )
}
