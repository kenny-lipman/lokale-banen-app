import type { ModelMessage } from 'ai'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { AGENT_MODEL_ID, AGENT_MODEL_PROVIDER } from './model'
import { appendAgentAuditEvent } from './audit'
import type {
  AgentChatMessage,
  AgentConversation,
  JsonObject,
  PersistMessageInput,
  PersistedMessage
} from './types'

type SupabaseLike = any

export type AgentConversationListItem = {
  id: string
  title: string | null
  modelProvider: string
  modelId: string
  createdAt: string
  updatedAt: string
}

export type AgentConversationMessage = {
  id: string
  role: string
  uiMessageId: string | null
  contentText: string | null
  parts: unknown[]
  metadata: JsonObject
  createdAt: string
}

export class AgentPersistenceError extends Error {
  constructor(
    message: string,
    public code: string = 'AGENT_PERSISTENCE_ERROR',
    public status: number = 500
  ) {
    super(message)
    this.name = 'AgentPersistenceError'
  }
}

function mapSupabasePersistenceError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string,
  status?: number
): AgentPersistenceError {
  if (error?.code === '42P01' || (status === 404 && !error?.message)) {
    return new AgentPersistenceError(
      'AI-chat database migration is nog niet toegepast.',
      'AGENT_CHAT_SCHEMA_MISSING',
      503
    )
  }

  if (error?.code === '23503') {
    return new AgentPersistenceError(
      'De huidige gebruiker kon niet aan een AI-chat gesprek gekoppeld worden.',
      'AGENT_CHAT_USER_REFERENCE_INVALID',
      400
    )
  }

  return new AgentPersistenceError(error?.message ?? fallback)
}

export function extractMessageText(message: AgentChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

export function findLatestUserMessage(messages: AgentChatMessage[]): AgentChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') {
      return messages[index]
    }
  }

  return null
}

export async function ensureAgentConversation(params: {
  conversationId?: string
  userId: string
  title?: string
  metadata?: JsonObject
  supabase?: SupabaseLike
}): Promise<AgentConversation> {
  const supabase = params.supabase ?? (createServiceRoleClient() as SupabaseLike)

  if (params.conversationId) {
    const { data, error } = await supabase
      .from('agent_chat_conversations')
      .select('id,user_id,model_provider,model_id')
      .eq('id', params.conversationId)
      .eq('user_id', params.userId)
      .maybeSingle()

    if (error) {
      throw mapSupabasePersistenceError(error, 'Gesprek ophalen mislukt')
    }

    if (!data) {
      throw new AgentPersistenceError('Conversation not found for current user', 'AGENT_CHAT_CONVERSATION_NOT_FOUND', 404)
    }

    await appendAgentAuditEvent({
      conversationId: data.id,
      userId: params.userId,
      eventType: 'conversation.reused',
      payload: { modelId: data.model_id }
    }, supabase)

    return {
      id: data.id,
      userId: data.user_id,
      modelProvider: data.model_provider,
      modelId: data.model_id
    }
  }

  const conversationResponse = await supabase
    .from('agent_chat_conversations')
    .insert({
      user_id: params.userId,
      title: params.title ?? null,
      model_provider: AGENT_MODEL_PROVIDER,
      model_id: AGENT_MODEL_ID,
      metadata: params.metadata ?? {}
    })
    .select('id,user_id,model_provider,model_id')
    .single()
  const { data, error } = conversationResponse

  if (error || !data) {
    throw mapSupabasePersistenceError(error, 'Failed to create agent conversation', conversationResponse.status)
  }

  await appendAgentAuditEvent({
    conversationId: data.id,
    userId: params.userId,
    eventType: 'conversation.created',
    payload: { modelId: data.model_id }
  }, supabase)

  return {
    id: data.id,
    userId: data.user_id,
    modelProvider: data.model_provider,
    modelId: data.model_id
  }
}

export async function persistAgentMessage(
  input: PersistMessageInput,
  supabase: SupabaseLike = createServiceRoleClient() as SupabaseLike
): Promise<PersistedMessage> {
  const { data, error } = await supabase
    .from('agent_chat_messages')
    .upsert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.message.role,
      ui_message_id: input.message.id,
      content_text: extractMessageText(input.message) || null,
      parts: input.message.parts,
      model_message: input.modelMessage ?? null,
      metadata: input.metadata ?? {}
    }, {
      onConflict: 'conversation_id,ui_message_id'
    })
    .select('id')
    .single()

  if (error || !data) {
    throw mapSupabasePersistenceError(error, 'Failed to persist agent message')
  }

  const { error: conversationError } = await supabase
    .from('agent_chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.conversationId)
    .eq('user_id', input.userId)

  if (conversationError) {
    throw mapSupabasePersistenceError(conversationError, 'Gesprek bijwerken mislukt')
  }

  await appendAgentAuditEvent({
    conversationId: input.conversationId,
    messageId: data.id,
    userId: input.userId,
    eventType: 'message.persisted',
    payload: {
      role: input.message.role,
      uiMessageId: input.message.id
    }
  }, supabase)

  return { id: data.id }
}

export function buildConversationTitle(message: AgentChatMessage | null): string | undefined {
  if (!message) return undefined

  const text = extractMessageText(message)
  if (!text) return undefined

  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

export function findModelMessageForUiMessage(
  modelMessages: ModelMessage[],
  uiMessage: AgentChatMessage | null
): ModelMessage | undefined {
  if (!uiMessage) return undefined

  const sameRoleMessages = modelMessages.filter((message) => message.role === uiMessage.role)
  return sameRoleMessages.at(-1)
}

export async function listAgentConversations(params: {
  userId: string
  limit?: number
  supabase?: SupabaseLike
}): Promise<AgentConversationListItem[]> {
  const supabase = params.supabase ?? (createServiceRoleClient() as SupabaseLike)
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)

  const { data, error } = await supabase
    .from('agent_chat_conversations')
    .select('id,title,model_provider,model_id,created_at,updated_at')
    .eq('user_id', params.userId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw mapSupabasePersistenceError(error, 'Gesprekken laden mislukt')
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    modelProvider: row.model_provider,
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function getAgentConversationMessages(params: {
  conversationId: string
  userId: string
  supabase?: SupabaseLike
}): Promise<AgentConversationMessage[]> {
  const supabase = params.supabase ?? (createServiceRoleClient() as SupabaseLike)

  const { data: conversation, error: conversationError } = await supabase
    .from('agent_chat_conversations')
    .select('id')
    .eq('id', params.conversationId)
    .eq('user_id', params.userId)
    .maybeSingle()

  if (conversationError) {
    throw mapSupabasePersistenceError(conversationError, 'Gesprek ophalen mislukt')
  }

  if (!conversation) {
    throw new AgentPersistenceError('Conversation not found for current user', 'AGENT_CHAT_CONVERSATION_NOT_FOUND', 404)
  }

  const { data, error } = await supabase
    .from('agent_chat_messages')
    .select('id,role,ui_message_id,content_text,parts,metadata,created_at')
    .eq('conversation_id', params.conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw mapSupabasePersistenceError(error, 'Berichten laden mislukt')
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    role: row.role,
    uiMessageId: row.ui_message_id,
    contentText: row.content_text,
    parts: Array.isArray(row.parts) ? row.parts : [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  }))
}
