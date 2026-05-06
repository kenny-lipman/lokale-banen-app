import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(req: NextRequest) {
  try {
    const pipelineIdParam = new URL(req.url).searchParams.get('pipeline_id')
    if (!pipelineIdParam) {
      return NextResponse.json({ error: 'pipeline_id query param required' }, { status: 400 })
    }
    const pipelineId = parseInt(pipelineIdParam, 10)
    if (Number.isNaN(pipelineId)) {
      return NextResponse.json({ error: 'pipeline_id must be a number' }, { status: 400 })
    }
    const service = new PipedriveMetaService()
    const stages = await service.getStages(pipelineId)
    return NextResponse.json({ stages })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAuth(handler)
