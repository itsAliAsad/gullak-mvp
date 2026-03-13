import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders markdown text with consistent Gullak styling.
 * Handles **bold**, *italic*, bullet lists, and numbered lists.
 * Does NOT render headings (agents don't use them) or code blocks.
 */
export function Markdown({ children, className = '' }) {
  if (!children) return null
  return (
    <span className={className || undefined}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Inline elements
        strong: ({ children }) => <strong className="font-semibold text-brown">{children}</strong>,
        em:     ({ children }) => <em className="italic">{children}</em>,
        // Paragraphs — no extra margin (parent controls spacing)
        p: ({ children }) => <span className="block">{children}</span>,
        // Lists
        ul: ({ children }) => <ul className="mt-1.5 ml-4 space-y-0.5 list-disc">{children}</ul>,
        ol: ({ children }) => <ol className="mt-1.5 ml-4 space-y-0.5 list-decimal">{children}</ol>,
        li: ({ children }) => <li className="text-[0.9em] leading-relaxed">{children}</li>,
        // Strip headings down to bold text (agents sometimes use ## accidentally)
        h1: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h2: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h3: ({ children }) => <strong className="font-semibold">{children}</strong>,
        // No horizontal rules or block quotes
        hr:         () => null,
        blockquote: ({ children }) => <span className="italic opacity-80">{children}</span>,
        // Inline code — style it simply
        code: ({ children }) => <code className="bg-sand/60 text-brown rounded px-1 text-[0.9em] font-mono">{children}</code>,
      }}
    >
      {children}
    </ReactMarkdown>
    </span>
  )
}
