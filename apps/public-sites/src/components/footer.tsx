import Link from 'next/link'
import { Linkedin, Instagram, Facebook, Twitter } from 'lucide-react'
import type { Tenant } from '@/lib/tenant'
import { getTopCities } from '@/lib/queries'

interface FooterProps {
  tenant: Tenant
  /** Hide footer on desktop (used on homepage split-view) */
  hiddenOnDesktop?: boolean
}

/**
 * Site-wide footer.
 * Background: var(--foreground) (#18181B)
 * Text: 13px/400, rgba(255,255,255,0.6)
 * Links: rgba(255,255,255,0.8), hover white
 */
export async function Footer({ tenant, hiddenOnDesktop = false }: FooterProps) {
  const topCities = await getTopCities(tenant.id)

  const hasSocials =
    tenant.social_linkedin ||
    tenant.social_instagram ||
    tenant.social_facebook ||
    tenant.social_tiktok ||
    tenant.social_twitter

  return (
    <footer
      className={hiddenOnDesktop ? 'lg:hidden' : undefined}
      style={{
        backgroundColor: 'var(--foreground)',
        padding: '32px 24px',
      }}
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Brand */}
        <div className="mb-6">
          <p
            className="text-h2 font-semibold"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            {tenant.name}
          </p>
          {tenant.hero_subtitle && (
            <p
              className="text-meta mt-1"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {tenant.hero_subtitle}
            </p>
          )}
        </div>

        {/* Navigation columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
          {/* Column: Vacatures */}
          <div>
            <p
              className="text-body-medium mb-3"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Vacatures
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-meta transition-colors hover:!text-white"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Alle vacatures
                </Link>
              </li>
              {topCities.map(({ city }) => (
                <li key={city}>
                  <Link
                    href={`/?location=${encodeURIComponent(city)}`}
                    className="text-meta transition-colors hover:!text-white"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    {city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column: Platform */}
          <div>
            <p
              className="text-body-medium mb-3"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Platform
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/over-ons"
                  className="text-meta transition-colors hover:!text-white"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Over ons
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-meta transition-colors hover:!text-white"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/voorwaarden"
                  className="text-meta transition-colors hover:!text-white"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Voorwaarden
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Contact */}
          <div>
            <p
              className="text-body-medium mb-3"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Contact
            </p>
            <ul className="space-y-2">
              {tenant.contact_email && (
                <li>
                  <a
                    href={`mailto:${tenant.contact_email}`}
                    className="text-meta transition-colors hover:!text-white"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    {tenant.contact_email}
                  </a>
                </li>
              )}
              {tenant.contact_phone && (
                <li>
                  <a
                    href={`tel:${tenant.contact_phone}`}
                    className="text-meta transition-colors hover:!text-white"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    {tenant.contact_phone}
                  </a>
                </li>
              )}
              <li>
                <Link
                  href="/contact"
                  className="text-meta transition-colors hover:!text-white"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Contactpagina
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Social icons */}
        {hasSocials && (
          <div className="flex items-center gap-4 mb-6">
            {tenant.social_linkedin && (
              <a
                href={tenant.social_linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:!text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            )}
            {tenant.social_instagram && (
              <a
                href={tenant.social_instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:!text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {tenant.social_facebook && (
              <a
                href={tenant.social_facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:!text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {tenant.social_tiktok && (
              <a
                href={tenant.social_tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta transition-colors hover:!text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="TikTok"
              >
                <TikTokIcon className="h-5 w-5" />
              </a>
            )}
            {tenant.social_twitter && (
              <a
                href={tenant.social_twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:!text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            )}
          </div>
        )}

        {/* Divider + copyright */}
        <div
          className="pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p
            className="text-meta"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            &copy; {new Date().getFullYear()} {tenant.name} &middot; Onderdeel van Lokale Banen Netwerk
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Custom TikTok SVG icon (not in lucide-react) */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.18 8.18 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-.36z" />
    </svg>
  )
}
