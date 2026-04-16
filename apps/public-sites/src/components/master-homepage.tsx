import Link from 'next/link'
import type { Tenant } from '@/lib/tenant'
import type { MasterJobPosting, PlatformSummary } from '@/lib/queries'
import { TenantHeader } from './tenant-header'
import { MasterPlatformCard, PlatformBadge } from './master-platform-card'
import { EditorialJobCard } from './editorial-job-card'
import { Footer } from './footer'

interface MasterHomepageProps {
  tenant: Tenant
  platforms: PlatformSummary[]
  recentJobs: MasterJobPosting[]
  totalJobs: number
}

/**
 * Master aggregator homepage — lokalebanen.nl
 *
 * Layout:
 *   1. TenantHeader (shared, no search)
 *   2. Context strip: "Lokale vacatures door heel Nederland" + totaalcount
 *   3. Platform grid: 4-col alphabetical grid of regio-tiles
 *   4. Recent jobs feed: latest 12 across all platforms + link to /vacatures
 *   5. Footer
 */
export function MasterHomepage({
  tenant,
  platforms,
  recentJobs,
  totalJobs,
}: MasterHomepageProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1">
        {/* ── Context strip ─────────────────────────────────────────── */}
        <section
          style={{
            maxWidth: 'var(--max)',
            margin: '0 auto',
            padding: '28px var(--pad) 16px',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display-stack)',
              fontWeight: 500,
              fontSize: 'clamp(1.6rem, 2.8vw, 2.1rem)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Lokale vacatures door{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--primary-dark)', fontWeight: 500 }}>
              heel Nederland
            </em>
          </h1>

          <div
            className="flex flex-wrap items-center gap-4 mt-3"
            style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono-stack)',
                fontSize: '0.8125rem',
                padding: '3px 9px',
                border: '1px solid var(--border)',
                borderRadius: 100,
                background: 'var(--surface)',
              }}
            >
              {totalJobs.toLocaleString('nl-NL')} open posities
            </span>
            <span>{platforms.length} regio-platforms</span>
          </div>
        </section>

        {/* ── Platform grid ─────────────────────────────────────────── */}
        <section
          style={{
            maxWidth: 'var(--max)',
            margin: '0 auto',
            padding: '8px var(--pad) 40px',
          }}
          aria-label="Regio-platforms"
        >
          <h2
            style={{
              fontFamily: 'var(--font-display-stack)',
              fontWeight: 500,
              fontSize: '1.0625rem',
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              marginBottom: 16,
            }}
          >
            Kies jouw regio
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {platforms.map((p) => (
              <MasterPlatformCard key={p.id} platform={p} />
            ))}
          </div>
        </section>

        {/* ── Section divider ───────────────────────────────────────── */}
        <div
          style={{
            maxWidth: 'var(--max)',
            margin: '0 auto',
            padding: '0 var(--pad)',
          }}
        >
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
        </div>

        {/* ── Recent jobs feed ──────────────────────────────────────── */}
        {recentJobs.length > 0 && (
          <section
            style={{
              maxWidth: 'var(--max)',
              margin: '0 auto',
              padding: '32px var(--pad) 40px',
            }}
            aria-label="Recente vacatures"
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                style={{
                  fontFamily: 'var(--font-display-stack)',
                  fontWeight: 500,
                  fontSize: '1.0625rem',
                  letterSpacing: '-0.01em',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Recente vacatures
              </h2>
              <Link
                href="/vacatures"
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--primary)',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Alle vacatures →
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {recentJobs.map((job) => (
                <div key={job.id} style={{ position: 'relative' }}>
                  {/* Platform badge — absolutely positioned top-right */}
                  {job.primary_platform && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 1,
                      }}
                    >
                      <PlatformBadge
                        name={job.primary_platform.name}
                        host={job.primary_platform.preview_domain ?? job.primary_platform.domain}
                      />
                    </div>
                  )}
                  <EditorialJobCard
                    job={job}
                    variant="mobile"
                    href={
                      job.primary_platform
                        ? buildCanonicalHref(job)
                        : `/vacature/${job.slug || job.id}`
                    }
                  />
                </div>
              ))}
            </div>

            {totalJobs > recentJobs.length && (
              <div className="mt-6 text-center">
                <Link
                  href="/vacatures"
                  style={{
                    display: 'inline-block',
                    padding: '10px 24px',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    border: '1.5px solid var(--primary)',
                    borderRadius: 'var(--r-md)',
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  Bekijk alle {totalJobs.toLocaleString('nl-NL')} vacatures
                </Link>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}

/** Build canonical URL for a master job — links to the primary platform's domain. */
function buildCanonicalHref(job: MasterJobPosting): string {
  const plat = job.primary_platform
  if (!plat) return `/vacature/${job.slug || job.id}`
  const host = plat.preview_domain ?? plat.domain
  if (host) return `https://${host}/vacature/${job.slug || job.id}`
  return `/vacature/${job.slug || job.id}`
}
