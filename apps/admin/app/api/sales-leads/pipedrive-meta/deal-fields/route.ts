import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(_req: NextRequest) {
  try {
    const service = new PipedriveMetaService()
    const deal_fields = await service.getDateDealFields()
    return NextResponse.json({ deal_fields })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
