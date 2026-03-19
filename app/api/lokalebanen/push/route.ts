import { NextRequest, NextResponse } from 'next/server'
import { requireAuthentication } from '@/lib/auth-middleware'
import { pushJobPostingsToLB } from '@/lib/services/lokalebanen-push.service'

/**
 * POST /api/lokalebanen/push
 * Push job postings to Lokale Banen with SSE progress stream
 * Note: Uses requireAuthentication directly instead of withAuth,
 * because withAuth expects NextResponse but SSE needs raw Response.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthentication(req)
    const { supabase } = authResult
    const { jobPostingIds } = await req.json()

    if (!jobPostingIds || !Array.isArray(jobPostingIds) || jobPostingIds.length === 0) {
      return NextResponse.json({ error: 'jobPostingIds array is required' }, { status: 400 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await pushJobPostingsToLB(jobPostingIds, supabase, (event) => {
            const data = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(data))
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Push failed'
          const errorEvent = `data: ${JSON.stringify({ type: 'error', current: 0, total: 0, message: errorMsg })}\n\n`
          controller.enqueue(encoder.encode(errorEvent))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}
