import { anthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

export const AGENT_MODEL_PROVIDER = 'anthropic'
export const AGENT_MODEL_ID = process.env.AGENT_CHAT_MODEL || 'claude-sonnet-4-6'

export function getAgentModel(): LanguageModel {
  return anthropic(AGENT_MODEL_ID)
}
