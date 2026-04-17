/**
 * Draft preview route for pending/unpublished vacatures.
 * TEMPORARY DEBUG VERSION — returns plain-text diagnostics.
 */

import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getTenantById, getTenantByHostForPreview } from '@/lib/tenant'
import { getJobByIdForPreview } from '@/lib/queries'
import { verifyPreviewToken } from '@lokale-banen/shared'

interface PreviewPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; platform?: string }>
}

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Draft Preview',
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { id } = await params
  const { token, platform } = await searchParams

  const tokenValid = token ? verifyPreviewToken(id, token) : false
  const host = (await headers()).get('x-tenant-host')

  const tenantById = platform ? await getTenantById(platform) : null
  const tenantByHost = host ? await getTenantByHostForPreview(host) : null
  const tenant = tenantById ?? tenantByHost

  const job = await getJobByIdForPreview(id)

  const debug = `PREVIEW DEBUG
token: ${token ? 'present' : 'missing'} (valid=${tokenValid})
host: ${host ?? 'null'}
platform param: ${platform ?? 'null'}
tenantById: ${tenantById ? `${tenantById.name} (${tenantById.id})` : 'null'}
tenantByHost: ${tenantByHost ? `${tenantByHost.name} (${tenantByHost.id})` : 'null'}
tenant (resolved): ${tenant ? tenant.name : 'null'}
job: ${job ? `${job.title}` : 'null'}
secret_len: ${process.env.VACATURE_PREVIEW_SECRET?.length ?? 0}
`
  return (
    <pre style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>{debug}</pre>
  )
}
