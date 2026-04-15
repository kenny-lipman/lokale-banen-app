/**
 * Shared types for the Platform detail page (6-tab editor).
 */

export interface PlatformDetail {
  id: string
  regio_platform: string
  central_place: string | null
  domain: string | null
  preview_domain: string | null
  is_public: boolean
  tier: string | null
  updated_at: string | null
  published_at: string | null

  // Branding
  logo_url: string | null
  favicon_url: string | null
  og_image_url: string | null
  primary_color: string | null

  // Content
  hero_title: string | null
  hero_subtitle: string | null
  about_text: string | null
  privacy_text: string | null
  terms_text: string | null

  // SEO
  seo_description: string | null
  indexnow_key: string | null

  // Contact
  contact_email: string | null
  contact_phone: string | null
  social_linkedin: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_tiktok: string | null
  social_twitter: string | null

  // Metadata
  approved_count?: number
}

/** Form values — string-only, nulls become empty strings for inputs. */
export interface PlatformFormValues {
  // Basis
  tier: string
  is_public: boolean
  domain: string

  // Branding
  logo_url: string
  favicon_url: string
  og_image_url: string
  primary_color: string

  // Content
  hero_title: string
  hero_subtitle: string
  about_text: string
  privacy_text: string
  terms_text: string

  // SEO
  seo_description: string

  // Contact
  contact_email: string
  contact_phone: string
  social_linkedin: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_twitter: string
}

export const DEFAULT_FORM_VALUES: PlatformFormValues = {
  tier: "free",
  is_public: false,
  domain: "",
  logo_url: "",
  favicon_url: "",
  og_image_url: "",
  primary_color: "#0066cc",
  hero_title: "",
  hero_subtitle: "",
  about_text: "",
  privacy_text: "",
  terms_text: "",
  seo_description: "",
  contact_email: "",
  contact_phone: "",
  social_linkedin: "",
  social_instagram: "",
  social_facebook: "",
  social_tiktok: "",
  social_twitter: "",
}

export const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
  { value: "enterprise", label: "Enterprise" },
] as const

export function platformToForm(platform: PlatformDetail): PlatformFormValues {
  return {
    tier: platform.tier ?? "free",
    is_public: platform.is_public,
    domain: platform.domain ?? "",
    logo_url: platform.logo_url ?? "",
    favicon_url: platform.favicon_url ?? "",
    og_image_url: platform.og_image_url ?? "",
    primary_color: platform.primary_color ?? "#0066cc",
    hero_title: platform.hero_title ?? "",
    hero_subtitle: platform.hero_subtitle ?? "",
    about_text: platform.about_text ?? "",
    privacy_text: platform.privacy_text ?? "",
    terms_text: platform.terms_text ?? "",
    seo_description: platform.seo_description ?? "",
    contact_email: platform.contact_email ?? "",
    contact_phone: platform.contact_phone ?? "",
    social_linkedin: platform.social_linkedin ?? "",
    social_instagram: platform.social_instagram ?? "",
    social_facebook: platform.social_facebook ?? "",
    social_tiktok: platform.social_tiktok ?? "",
    social_twitter: platform.social_twitter ?? "",
  }
}

/** Convert form values back to PATCH payload (empty string => null). */
export function formToPatchPayload(
  values: PlatformFormValues,
): Record<string, unknown> {
  const nullable = (v: string) => (v.trim().length === 0 ? null : v.trim())

  return {
    tier: nullable(values.tier) ?? "free",
    is_public: values.is_public,
    domain: nullable(values.domain),
    logo_url: nullable(values.logo_url),
    favicon_url: nullable(values.favicon_url),
    og_image_url: nullable(values.og_image_url),
    primary_color: nullable(values.primary_color) ?? "#0066cc",
    hero_title: nullable(values.hero_title),
    hero_subtitle: nullable(values.hero_subtitle),
    about_text: nullable(values.about_text),
    privacy_text: nullable(values.privacy_text),
    terms_text: nullable(values.terms_text),
    seo_description: nullable(values.seo_description),
    contact_email: nullable(values.contact_email),
    contact_phone: nullable(values.contact_phone),
    social_linkedin: nullable(values.social_linkedin),
    social_instagram: nullable(values.social_instagram),
    social_facebook: nullable(values.social_facebook),
    social_tiktok: nullable(values.social_tiktok),
    social_twitter: nullable(values.social_twitter),
  }
}

export const GO_LIVE_CHECKS = [
  { key: "domain", label: "Domein gezet", required: true },
  { key: "primary_color", label: "Primary color", required: true },
  { key: "logo_url", label: "Logo url aanwezig", required: false },
  { key: "hero_title", label: "Hero title", required: true },
  { key: "seo_description", label: "SEO description", required: true },
  { key: "min_approved_vacancies", label: "Min. 10 approved vacatures", required: true },
  { key: "about_text", label: "About text ingevuld", required: true },
] as const

export type GoLiveCheckKey = (typeof GO_LIVE_CHECKS)[number]["key"]

export interface GoLiveCheckItem {
  key: GoLiveCheckKey
  label: string
  required: boolean
  passed: boolean
  value?: string | number | null
}

export interface GoLiveCheckResponse {
  platform_id: string
  is_public: boolean
  published_at: string | null
  all_required_passed: boolean
  checks: GoLiveCheckItem[]
  approved_vacancy_count: number
}
