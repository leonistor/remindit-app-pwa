import { BRAND_NAME } from "@remindit/common/brand"
import { createFileRoute } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: `Send feedback — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Send ${BRAND_NAME} feedback — report a bug, request a feature, or start a discussion.`,
      },
    ],
  }),
  component: Feedback,
})

type FeedbackTag = "bug" | "feature-request" | "discussion"

const TAGS: ReadonlyArray<{ value: FeedbackTag; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "feature-request", label: "Feature request" },
  { value: "discussion", label: "Discussion" },
]

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
            <h2>Send feedback</h2>
            <p>Feedback isn’t configured for this deployment yet.</p>
          </>
        )}
      </section>
    </main>
  )
}

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
      setError(
        "Subject must be at least 6 characters, and details are required."
      )
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
        setError("Please check the fields and try again.")
        return
      }
      if (res.status === 502 || res.status === 503) {
        setError(
          "The feedback board is temporarily unavailable — please try again later."
        )
        return
      }
      if (!res.ok) {
        setError(
          "Something went wrong sending your feedback — please try again later."
        )
        return
      }
      const data = (await res.json()) as { questionUrl?: unknown }
      setQuestionUrl(
        typeof data.questionUrl === "string" ? data.questionUrl : null
      )
    } catch {
      setError(
        "Something went wrong sending your feedback — please try again later."
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (questionUrl) {
    return (
      <>
        <h2>Thanks for your feedback</h2>
        <p>Your question is live on the feedback board.</p>
        <p>
          <a
            className="cta"
            href={questionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View your question
          </a>
        </p>
      </>
    )
  }

  return (
    <>
      <h2>Send feedback</h2>
      <p>
        Tell us what’s working and what isn’t — no account needed. Leave a
        contact email and the team can follow up.
      </p>
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="feedback-subject">Subject</label>
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
          <label htmlFor="feedback-details">Details</label>
          <textarea
            id="feedback-details"
            required
            minLength={6}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="What happened, and what did you expect?"
          />
        </div>
        <div className="field">
          <label htmlFor="feedback-tag">Type</label>
          <select
            id="feedback-tag"
            value={tag}
            onChange={(event) => setTag(event.target.value as FeedbackTag)}
          >
            {TAGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="feedback-email">Contact email (optional)</label>
          <input
            id="feedback-email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="cta" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </>
  )
}
