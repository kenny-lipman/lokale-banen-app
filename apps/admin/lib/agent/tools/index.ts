import { createPlatformTools } from './platforms'
import { createPublicationTools } from './publication'
import type { AgentToolNamespaceDefinition } from './types'

export const AGENT_TOOL_NAMESPACES: AgentToolNamespaceDefinition[] = [
  {
    namespace: 'publication',
    description: 'Read-only vacature-publicatie en Lokale Banen push-readiness tools.',
    createTools: createPublicationTools
  },
  {
    namespace: 'platform',
    description: 'Read-only platform search, readiness en blocker tools.',
    createTools: createPlatformTools
  }
]

export * from './types'
