/**
 * Content section with H2 heading + HTML body.
 * Shared between JobDetailPanel and JobDetail.
 */
export function ContentSection({ title, html }: { title: string; html: string }) {
  return (
    <section>
      <h2 className="text-h2 text-foreground mb-3 mt-6">{title}</h2>
      <div
        className="text-body text-foreground leading-[22px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_p]:mb-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}
