import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

/**
 * Content section with H2 heading + body rendered as markdown.
 * Supports inline HTML (via rehype-raw) so legacy scraped content that still
 * contains <br>, <ul>, etc. renders correctly alongside newer markdown input.
 */
export function ContentSection({ title, content }: { title: string; content: string }) {
  return (
    <section>
      <h2 className="text-h2 text-foreground mb-3 mt-6">{title}</h2>
      <div className="prose prose-sm max-w-none text-body text-foreground leading-[22px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {content}
        </ReactMarkdown>
      </div>
    </section>
  )
}
