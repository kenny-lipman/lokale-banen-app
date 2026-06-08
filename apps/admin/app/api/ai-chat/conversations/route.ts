// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AuthResult } from '@/lib/auth-middleware'
import { listAgentConversations } from '@/lib/agent/persistence'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional()
})

async function getHandler(request: NextRequest, auth: AuthResult): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined
  })

  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: 'Invalid conversation list request',
      details: parsed.error.flatten()
    }, { status: 400 })
  }

  try {
    const conversations = await listAgentConversations({
      userId: auth.user.id,
      limit: parsed.data.limit
    })

    return NextResponse.json({ success: true, conversations })
  } catch (error) {
    console.error('AI chat conversations request failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load conversations'
    }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
