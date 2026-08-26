import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import changelog from "../../CHANGELOG.md"

// Renders the hand-maintained CHANGELOG.md (imported as raw text) with
// react-markdown. Element mappings reuse the app's Tailwind tokens so the page
// matches the About/Help views.
const ChangelogView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="font-bold text-2xl">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-6 border-t border-border pt-6 font-semibold text-xl first:mt-0 first:border-t-0 first:pt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-4 font-semibold text-base">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
            {children}
          </ul>
        ),
        hr: () => <hr className="border-t border-border" />,
        strong: ({ children }) => (
          <strong className="font-medium text-foreground">{children}</strong>
        ),
      }}
    >
      {changelog}
    </ReactMarkdown>
  </div>
)

export default ChangelogView
