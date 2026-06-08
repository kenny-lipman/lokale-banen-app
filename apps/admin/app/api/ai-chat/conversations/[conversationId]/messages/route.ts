// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AuthResult } from '@/lib/auth-middleware'
import {
  AgentPersistenceError,
  getAgentConversationMessages
} from '@/lib/agent/persistence'

const paramsSchema = z.object({
  conversationId: z.string().uuid()
})

async function getHandler(
  _request: NextRequest,
  auth: AuthResult,
  context: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  const rawParams = await context.params
  const parsed = paramsSchema.safeParse(rawParams)

  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: 'Invalid conversation id',
      details: parsed.error.flatten()
    }, { status: 400 })
  }

  try {
    const messages = await getAgentConversationMessages({
      conversationId: parsed.data.conversationId,
      userId: auth.user.id
    })

    return NextResponse.json({ success: true, messages })
  } catch (error) {
    if (error instanceof AgentPersistenceError) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: error.message.includes('not found') ? 404 : 500 })
    }

    console.error('AI chat messages request failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load conversation messages'
    }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
