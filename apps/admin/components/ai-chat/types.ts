import type { UIMessage } from 'ai'

export type AgentChatMetadata = {
  conversationId?: string
  modelId?: string
  createdAt?: string
}

export type AgentChatMessage = UIMessage<AgentChatMetadata>

export type AgentConversationSummary = {
  id: string
  title: string | null
  modelProvider: string
  modelId: string
  createdAt: string
  updatedAt: string
}

export type AgentPersistedMessage = {
  id: string
  role: string
  uiMessageId: string | null
  contentText: string | null
  parts: unknown[]
  metadata: AgentChatMetadata
  createdAt: string
}
