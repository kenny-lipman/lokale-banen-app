import type { ToolSet } from 'ai'
import type { AgentToolContext, AgentToolNamespace } from '../types'

export type AgentToolOutput<TData = unknown> = {
  summary: string
  data: TData
  warnings?: string[]
  nextActions?: string[]
}

export type AgentToolFactory = (context: AgentToolContext) => ToolSet

export type AgentToolNamespaceDefinition = {
  namespace: AgentToolNamespace
  description: string
  createTools: AgentToolFactory
}
