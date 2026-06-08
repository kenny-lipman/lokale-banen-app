import { createServiceRoleClient } from '@/lib/supabase-server'
import { safeAppendAgentAuditEvent } from '../audit'
import type { AgentToolContext, JsonObject } from '../types'
import type { AgentToolOutput } from './types'

type SupabaseLike = any

export function getToolSupabase(): SupabaseLike {
  return createServiceRoleClient() as SupabaseLike
}

function compactPayload(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { value }
  }

  return value as JsonObject
}

export async function runAuditedTool<TInput, TData>(
  params: {
    context: AgentToolContext
    toolName: string
    input: TInput
    run: (supabase: SupabaseLike) => Promise<AgentToolOutput<TData>>
  }
): Promise<AgentToolOutput<TData>> {
  const supabase = getToolSupabase()
  const startedAt = Date.now()

  await safeAppendAgentAuditEvent({
    conversationId: params.context.conversationId,
    userId: params.context.userId,
    eventType: 'tool.called',
    payload: {
      toolName: params.toolName,
      input: compactPayload(params.input)
    }
  }, supabase)

  try {
    const output = await params.run(supabase)
    await safeAppendAgentAuditEvent({
      conversationId: params.context.conversationId,
      userId: params.context.userId,
      eventType: 'tool.completed',
      payload: {
        toolName: params.toolName,
        durationMs: Date.now() - startedAt,
        summary: output.summary,
        warningCount: output.warnings?.length ?? 0,
        nextActionCount: output.nextActions?.length ?? 0
      }
    }, supabase)

    return output
  } catch (error) {
    await safeAppendAgentAuditEvent({
      conversationId: params.context.conversationId,
      userId: params.context.userId,
      eventType: 'tool.error',
      payload: {
        toolName: params.toolName,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      }
    }, supabase)

    throw error
  }
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}
