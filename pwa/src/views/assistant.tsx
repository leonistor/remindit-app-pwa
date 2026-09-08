// In-app support assistant (phase 1) — asks RemindIt support/help questions
// about the app, grounded on bff/content/support-en.md.
//
// Uses Assistant UI (the AI SDK runtime) against the BFF's /api/ai/chat route,
// which streams a VoltAgent response back. The assistant answers in the user's
// app locale (language-by-profile) — the locale rides the chat request body.
// A feedback composer below the thread posts bug/feature reports to the BFF's
// /api/feedback endpoint, attributed to the signed-in user when present. The
// whole view is lazy-loaded from the router so the assistant stack never
// touches the main list LCP.

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk"

import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
} from "@assistant-ui/react-markdown"
import { type FC, memo, useState } from "react"
import remarkGfm from "remark-gfm"
import { BackButton } from "@/components/back-button"
import { env } from "@/lib/env"
import { bffApi, type FeedbackKind } from "@/lib/bff-api"
import { getActiveLocale } from "@/lib/locale"
import { m } from "@/paraglide/messages"
import { createItemAndAddToList } from "@/stores/commands"
import { $categories } from "@/stores/categories"
import { getActiveGroupId } from "@/stores/sync/engine"
import { getSession } from "@/stores/sync/session"
import { UNCATEGORIZED_ID } from "@/stores/types"

const SUGGESTED_ACTIONS = [
  m.assistantSuggestionShare,
  m.assistantSuggestionOffline,
  m.assistantSuggestionPalette,
  m.assistantSuggestionPips,
]

// Task B (app commands, D15): resolve the category the model named (by name,
// case-insensitive) to a local category id; unknown names fall back to the
// uncategorized sentinel so the add always lands.
const resolveCategoryId = (name?: unknown): string => {
  if (typeof name !== "string" || !name.trim()) return UNCATEGORIZED_ID
  const wanted = name.trim().toLowerCase()
  const match = $categories.get().find(
    (c) => c.name.toLowerCase() === wanted
  )
  return match?.id ?? UNCATEGORIZED_ID
}

const AssistantView = () => {
  // The chat request rides the signed-in session when present: the Bearer
  // token (so Task A memory is per-user) and the active team id (so the
  // command tools are enabled). Both are read per-request via resolvables —
  // signing in/out or switching the active list mid-view is honored.
  const transport = new AssistantChatTransport({
    api: `${env.bffUrl}/api/ai/chat`,
    headers: () => {
      const token = getSession()?.token
      return token ? { authorization: `Bearer ${token}` } : {}
    },
    body: () => ({
      locale: getActiveLocale(),
      ...(getSession() ? { teamId: getActiveGroupId() } : {}),
    }),
  })

  // Client-executed command tools (D15): the BFF streams the `add_item` tool
  // call and confirms it server-side (no BFF write path); here the REAL write
  // runs against the local stores (journal → LWW → sync). Deliberately returns
  // nothing — the server already completed the tool's turn, so no result is
  // fed back (returning one would re-send the turn).
  const onToolCall = async ({ toolCall }: {
    toolCall: { toolName: string; args?: Record<string, unknown>; input?: unknown }
  }): Promise<void> => {
    if (toolCall.toolName !== "add_item") return
    const args =
      (toolCall.args ?? (typeof toolCall.input === "object" && toolCall.input
        ? toolCall.input
        : {})) as { name?: unknown; category?: unknown }
    const name = typeof args.name === "string" ? args.name.trim() : ""
    if (!name) return
    createItemAndAddToList(name, resolveCategoryId(args.category))
  }

  const runtime = useChatRuntime({
    transport,
    onToolCall,
  })

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="font-bold text-2xl">{m.assistantTitle()}</h1>
      </div>
      <p className="text-muted-foreground text-sm">{m.assistantIntro()}</p>

      <AssistantRuntimeProvider runtime={runtime}>
        <div className="flex h-[28rem] flex-col overflow-hidden rounded-3xl border bg-background shadow-xs">
          <ChatThread />
        </div>
      </AssistantRuntimeProvider>

      <FeedbackComposer />
    </div>
  )
}

const ChatThread: FC = () => (
  <ThreadPrimitive.Root className="flex h-full flex-col">
    <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-scroll px-4">
      <ThreadPrimitive.If empty>
        <ThreadWelcome />
      </ThreadPrimitive.If>
      <ThreadPrimitive.Messages
        components={{ UserMessage, AssistantMessage }}
      />
      <Composer />
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
)

const ThreadWelcome: FC = () => (
  <div className="mx-auto flex flex-grow flex-col items-center justify-center gap-4 py-8">
    <p className="font-semibold text-lg">{m.assistantGreeting()}</p>
    <div className="grid w-full max-w-md gap-2">
      {SUGGESTED_ACTIONS.map((label) => {
        const prompt = label()
        return (
          <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send asChild>
            <button
              type="button"
              className="rounded-xl border px-4 py-2.5 text-left text-muted-foreground text-sm hover:bg-accent"
            >
              {prompt}
            </button>
          </ThreadPrimitive.Suggestion>
        )
      })}
    </div>
  </div>
)

const Composer: FC = () => (
  <div className="sticky bottom-0 mx-auto flex w-full flex-col gap-1 rounded-b-3xl bg-background pb-3">
    <ComposerPrimitive.Root className="flex w-full flex-col rounded-2xl border bg-background px-3 py-2">
      <ComposerPrimitive.Input
        placeholder={m.assistantPlaceholder()}
        className="max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none"
        rows={1}
        aria-label={m.assistantPlaceholder()}
      />
      <div className="flex items-center justify-end gap-2">
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send asChild>
            <button type="submit" className="rounded-full px-4 py-1.5 text-sm">
              {m.assistantSend()}
            </button>
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel asChild>
            <button type="button" className="rounded-full px-4 py-1.5 text-sm">
              {m.assistantStop()}
            </button>
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
      </div>
    </ComposerPrimitive.Root>
  </div>
)

const FeedbackComposer: FC = () => {
  const [kind, setKind] = useState<FeedbackKind>("bug")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )

  const submit = async () => {
    const trimmed = message.trim()
    if (!trimmed || status === "sending") return
    setStatus("sending")
    try {
      const token = getSession()?.token
      await bffApi.submitFeedback(
        { kind, message: trimmed, locale: getActiveLocale() },
        token,
      )
      setMessage("")
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  const kinds: { value: FeedbackKind; label: string }[] = [
    { value: "bug", label: m.assistantFeedbackKindBug() },
    { value: "feature", label: m.assistantFeedbackKindFeature() },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-background p-4 shadow-xs">
      <h2 className="font-semibold text-sm">{m.assistantFeedbackTitle()}</h2>
      <div className="flex rounded-xl bg-muted p-1">
        {kinds.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              kind === value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={m.assistantFeedbackPlaceholder()}
        aria-label={m.assistantFeedbackPlaceholder()}
        rows={3}
        className="max-h-40 min-h-20 w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-destructive text-sm" aria-live="polite">
          {status === "error" ? m.assistantFeedbackError() : ""}
        </p>
        {status === "sent" ? (
          <p className="ml-auto text-muted-foreground text-sm" aria-live="polite">
            {m.assistantFeedbackSent()}
          </p>
        ) : (
          <button
            type="button"
            disabled={!message.trim() || status === "sending"}
            onClick={() => void submit()}
            className="rounded-full px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {m.assistantFeedbackSubmit()}
          </button>
        )}
      </div>
    </div>
  )
}

const UserMessage: FC = () => (
  <MessagePrimitive.Root asChild>
    <div className="mx-auto w-full px-2 py-3" data-role="user">
      <div className="ml-auto w-fit max-w-[85%] break-words rounded-2xl bg-muted px-4 py-2">
        <MessagePrimitive.Parts />
      </div>
    </div>
  </MessagePrimitive.Root>
)

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root asChild>
    <div className="mx-auto flex w-full px-2 py-3" data-role="assistant">
      <div className="w-fit max-w-[85%] break-words leading-7">
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
        <MessageError />
      </div>
    </div>
  </MessagePrimitive.Root>
)

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="mt-2 rounded-md border bg-destructive/10 p-2.5 text-destructive text-sm">
      <ErrorPrimitive.Message />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
)

const MarkdownText = memo(() => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    components={markdownComponents}
  />
))

const markdownComponents = memoizeMarkdownComponents({
  p: (props) => (
    <p className="my-2 leading-7 first:mt-0 last:mb-0" {...props} />
  ),
  ul: (props) => <ul className="my-2 ml-5 list-disc [&>li]:mt-1" {...props} />,
  ol: (props) => (
    <ol className="my-2 ml-5 list-decimal [&>li]:mt-1" {...props} />
  ),
  a: (props) => (
    <a
      className="font-medium text-primary underline underline-offset-4"
      {...props}
    />
  ),
  strong: (props) => <strong {...props} />,
  em: (props) => <em {...props} />,
})

export default AssistantView
