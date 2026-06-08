// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AuthResult } from '@/lib/auth-middleware'
import { createAgentChatStream } from '@/lib/agent'
import { AgentPersistenceError } from '@/lib/agent/persistence'
import type { AgentChatRequest } from '@/lib/agent'

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().max(8000)
}).passthrough()

const supportedPartSchema = z.union([
  textPartSchema,
  z.object({ type: z.literal('step-start') }).passthrough(),
  z.object({ type: z.literal('dynamic-tool') }).passthrough(),
  z.object({ type: z.string().regex(/^tool-/) }).passthrough()
])

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  metadata: z.record(z.unknown()).optional(),
  parts: z.array(supportedPartSchema).min(1).max(40)
}).passthrough()

const requestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(messageSchema).min(1).max(40),
  metadata: z.record(z.unknown()).optional()
})

async function postHandler(request: NextRequest, auth: AuthResult): Promise<NextResponse> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON body'
    }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: 'Invalid AI chat request',
      details: parsed.error.flatten()
    }, { status: 400 })
  }

  let response: Response

  try {
    response = await createAgentChatStream({
      request: parsed.data as unknown as AgentChatRequest,
      auth,
      abortSignal: request.signal
    })
  } catch (error) {
    if (error instanceof AgentPersistenceError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code
      }, { status: error.status })
    }

    console.error('AI chat route failed:', error)
    return NextResponse.json({
      success: false,
      error: 'AI chat request failed'
    }, { status: 500 })
  }

  return response as NextResponse
}

export const POST = withAdminAuth(postHandler)
