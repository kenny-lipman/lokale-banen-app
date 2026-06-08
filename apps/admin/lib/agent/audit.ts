import { createServiceRoleClient } from '@/lib/supabase-server'
import type { AgentAuditEventInput } from './types'

type SupabaseLike = any

export async function appendAgentAuditEvent(
  event: AgentAuditEventInput,
  supabase: SupabaseLike = createServiceRoleClient() as SupabaseLike
): Promise<void> {
  const { error } = await supabase.from('agent_chat_audit_events').insert({
    conversation_id: event.conversationId ?? null,
    message_id: event.messageId ?? null,
    user_id: event.userId ?? null,
    event_type: event.eventType,
    payload: event.payload ?? {}
  })

  if (error) {
    throw new Error(`Failed to append agent audit event: ${error.message}`)
  }
}

export async function safeAppendAgentAuditEvent(
  event: AgentAuditEventInput,
  supabase: SupabaseLike = createServiceRoleClient() as SupabaseLike
): Promise<void> {
  try {
    await appendAgentAuditEvent(event, supabase)
  } catch (error) {
    console.error('Agent audit event failed:', error)
  }
}
