import { consumeStream, convertToModelMessages, createIdGenerator, streamText } from 'ai'
import type { AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { AGENT_MODEL_ID, getAgentModel } from './model'
import { AGENT_SYSTEM_PROMPT } from './system-prompt'
import { safeAppendAgentAuditEvent } from './audit'
import { createAgentTools, listAgentToolCapabilities } from './tool-registry'
import {
  buildConversationTitle,
  ensureAgentConversation,
  findLatestUserMessage,
  findModelMessageForUiMessage,
  persistAgentMessage
} from './persistence'
import type { AgentChatRequest } from './types'

const generateAgentMessageId = createIdGenerator({
  prefix: 'agentmsg',
  size: 16
})

export async function createAgentChatStream(params: {
  request: AgentChatRequest
  auth: AuthResult
  abortSignal?: AbortSignal
}): Promise<Response> {
  const supabase = createServiceRoleClient() as any
  const latestUserMessage = findLatestUserMessage(params.request.messages)
  const conversation = await ensureAgentConversation({
    conversationId: params.request.conversationId,
    userId: params.auth.user.id,
    title: buildConversationTitle(latestUserMessage),
    metadata: params.request.metadata,
    supabase
  })

  const tools = createAgentTools({
    userId: params.auth.user.id,
    userEmail: params.auth.profile.email,
    conversationId: conversation.id
  })

  const modelMessages = await convertToModelMessages(params.request.messages, {
    tools,
    ignoreIncompleteToolCalls: true
  })

  if (latestUserMessage) {
    await persistAgentMessage({
      conversationId: conversation.id,
      userId: params.auth.user.id,
      message: latestUserMessage,
      modelMessage: findModelMessageForUiMessage(modelMessages, latestUserMessage),
      metadata: { source: 'request' }
    }, supabase)
  }

  await safeAppendAgentAuditEvent({
    conversationId: conversation.id,
    userId: params.auth.user.id,
    eventType: 'chat.requested',
    payload: {
      modelId: AGENT_MODEL_ID,
      messageCount: params.request.messages.length,
      tools: listAgentToolCapabilities()
    }
  }, supabase)

  const result = streamText({
    model: getAgentModel(),
    system: AGENT_SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    abortSignal: params.abortSignal,
    onFinish: async (event) => {
      await safeAppendAgentAuditEvent({
        conversationId: conversation.id,
        userId: params.auth.user.id,
        eventType: 'chat.completed',
        payload: {
          modelId: AGENT_MODEL_ID,
          finishReason: event.finishReason,
          totalUsage: event.totalUsage,
          toolCallCount: event.toolCalls.length
        }
      }, supabase)
    },
    onError: async (event) => {
      await safeAppendAgentAuditEvent({
        conversationId: conversation.id,
        userId: params.auth.user.id,
        eventType: 'chat.error',
        payload: {
          modelId: AGENT_MODEL_ID,
          error: event.error instanceof Error ? event.error.message : String(event.error)
        }
      }, supabase)
    }
  })

  return result.toUIMessageStreamResponse({
    originalMessages: params.request.messages,
    generateMessageId: generateAgentMessageId,
    consumeSseStream: consumeStream,
    sendReasoning: false,
    headers: {
      'x-agent-conversation-id': conversation.id
    },
    messageMetadata: ({ part }) => {
      if (part.type !== 'text-start' && part.type !== 'text-end') {
        return undefined
      }

      return {
        conversationId: conversation.id,
        modelId: AGENT_MODEL_ID,
        createdAt: new Date().toISOString()
      }
    },
    onFinish: async ({ responseMessage, finishReason, isAborted }) => {
      await persistAgentMessage({
        conversationId: conversation.id,
        userId: params.auth.user.id,
        message: responseMessage,
        metadata: {
          source: 'assistant_response',
          finishReason,
          isAborted
        }
      }, supabase)
    }
  })
}
