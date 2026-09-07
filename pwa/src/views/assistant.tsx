// In-app support assistant (phase 1) — asks RemindIt support/help questions
// about the app, grounded on bff/content/support-en.md.
//
// Uses Assistant UI (the AI SDK runtime) against the BFF's /api/ai/chat route,
// which streams a VoltAgent response back. English-only this phase (locale
// selection per profile is a roadmap item). The whole view is lazy-loaded from
// the router so the assistant stack never touches the main list LCP.

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
import { type FC, memo } from "react"
import remarkGfm from "remark-gfm"
import { BackButton } from "@/components/back-button"
import { env } from "@/lib/env"
import { m } from "@/paraglide/messages"

const SUGGESTED_ACTIONS = [
  "How do I share my shopping list?",
  "Is RemindIt usable offline?",
  "How do I change the color palette?",
  "What do the red and amber pips mean?",
]

const AssistantView = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${env.bffUrl}/api/ai/chat`,
    }),
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
      {SUGGESTED_ACTIONS.map((prompt) => (
        <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send asChild>
          <button
            type="button"
            className="rounded-xl border px-4 py-2.5 text-left text-muted-foreground text-sm hover:bg-accent"
          >
            {prompt}
          </button>
        </ThreadPrimitive.Suggestion>
      ))}
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
