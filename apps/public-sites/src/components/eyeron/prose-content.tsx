import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/lib/utils'

interface ProseContentProps {
  /** Markdown of HTML string. ReactMarkdown handelt beide via rehype-raw. */
  children: string
  className?: string
  /** Smaller (default) of "wide" voor full-width content. */
  variant?: 'default' | 'wide'
}

/**
 * Eyeron prose-wrapper voor markdown-content. Headings in primary bold,
 * body in body-grey light, links in secondary. Lijsten en blockquotes
 * gerespecteerd via Tailwind typography plugin.
 */
export function ProseContent({
  children,
  className,
  variant = 'default',
}: ProseContentProps) {
  return (
    <div
      className={cn(
        'prose prose-sm',
        variant === 'wide' ? 'max-w-none' : 'max-w-prose',
        // Headings → primary bold
        'prose-headings:text-primary prose-headings:font-bold prose-headings:tracking-tight',
        'prose-h1:text-h1 prose-h2:text-h2 prose-h3:text-h3',
        'prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-8 prose-h3:mb-3',
        // Body
        'prose-p:font-light prose-p:text-body prose-p:leading-relaxed',
        'prose-li:font-light prose-li:text-body',
        // Strong → primary bold
        'prose-strong:text-primary prose-strong:font-bold',
        // Links → secondary
        'prose-a:text-secondary prose-a:no-underline hover:prose-a:underline hover:prose-a:underline-offset-2',
        // Code
        'prose-code:text-primary prose-code:bg-divider-subtle prose-code:px-1 prose-code:rounded-none',
        // Blockquote
        'prose-blockquote:border-l-secondary prose-blockquote:text-body',
        // Tables
        'prose-table:text-meta prose-th:text-primary prose-th:font-bold',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
