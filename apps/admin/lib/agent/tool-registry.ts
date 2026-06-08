import type { ToolSet } from 'ai'
import { AGENT_TOOL_NAMESPACES } from './tools'
import type { AgentToolContext, AgentToolNamespace } from './types'

export type AgentToolCapability = {
  name: string
  namespace: AgentToolNamespace
  description: string
  enabled: boolean
}

export function createAgentTools(context: AgentToolContext): ToolSet {
  return AGENT_TOOL_NAMESPACES.reduce<ToolSet>((tools, namespace) => {
    return {
      ...tools,
      ...namespace.createTools(context)
    }
  }, {})
}

export function listAgentToolCapabilities(): AgentToolCapability[] {
  return AGENT_TOOL_NAMESPACES.flatMap((namespace) => {
    const tools = namespace.createTools({
      userId: 'capability-list',
      userEmail: 'capability-list',
      conversationId: 'capability-list'
    })

    return Object.entries(tools).map(([name, tool]) => ({
      name,
      namespace: namespace.namespace,
      description: tool.description ?? namespace.description,
      enabled: true
    }))
  })
}
