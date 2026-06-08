import type { ModelMessage, UIMessage } from 'ai'

export type JsonObject = Record<string, unknown>

export type AgentChatRole = 'user' | 'assistant' | 'system' | 'tool'

export type AgentToolNamespace = 'publication' | 'platform'

export type AgentToolContext = {
  userId: string
  userEmail: string
  conversationId: string
}

export type AgentChatMessageMetadata = {
  conversationId?: string
  modelId?: string
  createdAt?: string
}

export type AgentChatMessage = UIMessage<AgentChatMessageMetadata>

export type AgentChatRequest = {
  conversationId?: string
  messages: AgentChatMessage[]
  metadata?: JsonObject
}

export type AgentConversation = {
  id: string
  userId: string
  modelProvider: string
  modelId: string
}

export type PersistMessageInput = {
  conversationId: string
  userId: string
  message: AgentChatMessage
  modelMessage?: ModelMessage
  metadata?: JsonObject
}

export type PersistedMessage = {
  id: string
}

export type AgentAuditEventType =
  | 'conversation.created'
  | 'conversation.reused'
  | 'message.persisted'
  | 'chat.requested'
  | 'chat.completed'
  | 'chat.error'
  | 'tool.called'
  | 'tool.completed'
  | 'tool.error'

export type AgentAuditEventInput = {
  conversationId?: string
  messageId?: string
  userId?: string
  eventType: AgentAuditEventType
  payload?: JsonObject
}
