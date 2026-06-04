// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Vaste, vertrouwde logo-bron. Alleen het domein is variabel, de host staat vast,
// dus geen SSRF-risico naar willekeurige URLs. Clearbit geeft of een echt logo,
// of niets (waarna de gebruiker zelf uploadt). De Google-favicon fallback is
// bewust weggelaten omdat die vaak een lelijke lage-kwaliteit favicon teruggaf.
function logoCandidates(domain: string): string[] {
  return [`https://logo.clearbit.com/${domain}`]
}

// Leid het bare domein af uit een website-veld. Prefix https:// als het protocol
// ontbreekt, strip leading www. Returnt null bij invalide input.
function deriveDomain(website: string): string | null {
  const trimmed = website.trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return null
  }
}

async function fetchLogo(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength === 0) return null
    return { bytes: new Uint8Array(buffer), contentType: contentType.split(';')[0].trim() }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function logoSuggestHandler(
  _req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, website')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({ success: false, error: 'Bedrijf niet gevonden' }, { status: 404 })
    }

    if (!company.website || !company.website.trim()) {
      return NextResponse.json(
        { success: false, error: 'Dit bedrijf heeft geen website ingevuld' },
        { status: 400 },
      )
    }

    const domain = deriveDomain(company.website)
    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Kon geen geldig domein afleiden uit de website' },
        { status: 400 },
      )
    }

    let logo: { bytes: Uint8Array; contentType: string } | null = null
    for (const candidate of logoCandidates(domain)) {
      logo = await fetchLogo(candidate)
      if (logo) break
    }

    if (!logo) {
      return NextResponse.json(
        { success: false, error: 'Geen logo gevonden voor dit domein' },
        { status: 404 },
      )
    }

    const path = `${id}/logo`
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(path, logo.bytes, { contentType: logo.contentType, upsert: true })

    if (uploadError) {
      console.error('Error uploading suggested logo:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Logo opslaan mislukt' },
        { status: 500 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/company-logos/${path}`

    return NextResponse.json({ success: true, data: { logoUrl: publicUrl } })
  } catch (error) {
    console.error('Error in company logo-suggest:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Logo ophalen mislukt' },
      { status: 500 },
    )
  }
}

export const POST = withAuth(logoSuggestHandler)
