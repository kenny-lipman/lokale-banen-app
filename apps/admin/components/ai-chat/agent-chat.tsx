"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { DefaultChatTransport, readUIMessageStream } from "ai"
import {
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Sparkles,
  User,
  Wrench,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  AgentChatMessage,
  AgentConversationSummary,
  AgentPersistedMessage,
} from "./types"

type ChatStatus = "idle" | "loading" | "streaming" | "error"
type AgentMessagePart = AgentChatMessage["parts"][number]

type ConversationsResponse = {
  success: boolean
  conversations?: AgentConversationSummary[]
  error?: string
}

type MessagesResponse = {
  success: boolean
  messages?: AgentPersistedMessage[]
  error?: string
}

type ApiErrorResponse = {
  success?: false
  error?: string
  code?: string
}

const quickPrompts = [
  "Welke vacatures zijn klaar om te publiceren?",
  "Controleer de publicatiestatus van vacature ",
  "Welke platforms zijn beschikbaar voor publicatie?",
]

const MAX_MESSAGES_PER_REQUEST = 36

function createClientMessage(text: string): AgentChatMessage {
  return {
    id: `client-${crypto.randomUUID()}`,
    role: "user",
    parts: [{ type: "text", text }],
  }
}

function toConversationTitle(conversation: AgentConversationSummary): string {
  if (conversation.title?.trim()) return conversation.title
  return `Gesprek ${conversation.id.slice(0, 8)}`
}

function formatRelativeDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function persistedToUiMessage(message: AgentPersistedMessage): AgentChatMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null
  }

  const fallbackParts = message.contentText
    ? [{ type: "text" as const, text: message.contentText }]
    : []

  return {
    id: message.uiMessageId ?? message.id,
    role: message.role,
    metadata: message.metadata,
    parts: message.parts.length > 0 ? message.parts as AgentChatMessage["parts"] : fallbackParts,
  }
}

function getToolName(part: AgentMessagePart): string {
  if (part.type === "dynamic-tool") return part.toolName
  if (part.type.startsWith("tool-")) return part.type.replace(/^tool-/, "")
  return part.type
}

function getToolState(part: AgentMessagePart): string | undefined {
  return "state" in part && typeof part.state === "string" ? part.state : undefined
}

function getToolOutput(part: AgentMessagePart): unknown {
  if ("output" in part) return part.output
  return undefined
}

function getToolInput(part: AgentMessagePart): unknown {
  if ("input" in part) return part.input
  return undefined
}

function stringifyPreview(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function userFacingApiError(data: ApiErrorResponse | null, fallback: string): string {
  if (data?.code === "AGENT_CHAT_SCHEMA_MISSING") {
    return "De AI-chat database is nog niet ingericht. Pas de Supabase migration toe en probeer opnieuw."
  }

  if (data?.code === "AGENT_CHAT_CONVERSATION_NOT_FOUND") {
    return "Dit gesprek bestaat niet meer of hoort niet bij je account. Start een nieuw gesprek."
  }

  return data?.error || fallback
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json() as ApiErrorResponse
    return userFacingApiError(data, fallback)
  } catch {
    return fallback
  }
}

function ToolActivity({ part }: { part: AgentMessagePart }) {
  const state = getToolState(part)
  const done = state === "output-available"
  const failed = state === "output-error"
  const output = stringifyPreview(getToolOutput(part))
  const input = stringifyPreview(getToolInput(part))

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : failed ? (
          <XCircle className="size-4 text-red-600" />
        ) : (
          <Wrench className="size-4 text-orange-600" />
        )}
        <span className="font-medium">Tool: {getToolName(part)}</span>
        {state && (
          <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px]">
            {state}
          </Badge>
        )}
      </div>
      {input && (
        <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap rounded-sm bg-white p-2 text-[11px] text-slate-600">
          {input}
        </pre>
      )}
      {output && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-sm bg-white p-2 text-[11px] text-slate-800">
          {output}
        </pre>
      )}
    </div>
  )
}

function ChatMessage({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white">
          <Bot className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[min(720px,82%)] rounded-lg border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-orange-200 bg-orange-50 text-slate-900"
            : "border-slate-200 bg-white text-slate-800 shadow-sm",
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                {part.text}
              </p>
            )
          }

          if (part.type === "step-start") {
            return (
              <div key={`${message.id}-${index}`} className="my-2 border-t border-dashed border-slate-200" />
            )
          }

          if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
            return <ToolActivity key={`${message.id}-${index}`} part={part} />
          }

          return null
        })}
      </div>
      {isUser && (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <User className="size-4" />
        </div>
      )}
    </div>
  )
}

export function AgentChat() {
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([])
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [input, setInput] = useState("")
  const [status, setStatus] = useState<ChatStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const busy = status === "loading" || status === "streaming"
  const activeConversation = conversations.find((item) => item.id === conversationId)

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role === "user" || message.role === "assistant"),
    [messages],
  )

  useEffect(() => {
    void loadConversations()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" })
  }, [visibleMessages, status])

  async function loadConversations() {
    const response = await fetch("/api/ai-chat/conversations?limit=25")
    const data = await response.json() as ConversationsResponse

    if (data.success && data.conversations) {
      setConversations(data.conversations)
    }
  }

  async function loadConversation(id: string) {
    abortRef.current?.abort()
    setStatus("loading")
    setError(null)

    try {
      const response = await fetch(`/api/ai-chat/conversations/${id}/messages`)
      const data = await response.json() as MessagesResponse

      if (!response.ok || !data.success || !data.messages) {
        throw new Error(data.error ?? "Kon het gesprek niet laden")
      }

      setConversationId(id)
      setMessages(data.messages.map(persistedToUiMessage).filter(Boolean) as AgentChatMessage[])
      setStatus("idle")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kon het gesprek niet laden")
      setStatus("error")
    }
  }

  function startNewConversation() {
    abortRef.current?.abort()
    setConversationId(undefined)
    setMessages([])
    setInput("")
    setError(null)
    setStatus("idle")
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || busy) return

    const userMessage = createClientMessage(text)
    const nextMessages = [...messages, userMessage]
    const requestMessages = nextMessages.slice(-MAX_MESSAGES_PER_REQUEST)
    setMessages(nextMessages)
    setInput("")
    setError(null)
    setStatus("loading")

    const abortController = new AbortController()
    abortRef.current = abortController
    let responseConversationId = conversationId

    try {
      const transport = new DefaultChatTransport<AgentChatMessage>({
        api: "/api/ai-chat",
        fetch: async (input, init) => {
          const response = await fetch(input, init)
          responseConversationId = response.headers.get("x-agent-conversation-id") ?? responseConversationId
          if (!response.ok) {
            throw new Error(await parseApiError(response, "De AI-chat kon niet starten"))
          }
          return response
        },
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            conversationId: responseConversationId,
            messages: messages.slice(-MAX_MESSAGES_PER_REQUEST),
            metadata: { source: "admin_ai_chat" },
          },
        }),
      })

      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: responseConversationId ?? "new-agent-chat",
        messageId: userMessage.id,
        messages: requestMessages,
        abortSignal: abortController.signal,
      })

      setStatus("streaming")
      let latestAssistant: AgentChatMessage | undefined

      for await (const streamedMessage of readUIMessageStream<AgentChatMessage>({ stream })) {
        latestAssistant = streamedMessage
        setMessages([...nextMessages, streamedMessage])
      }

      if (latestAssistant) {
        setMessages([...nextMessages, latestAssistant])
      }

      if (responseConversationId) {
        setConversationId(responseConversationId)
      }

      setStatus("idle")
      await loadConversations()
    } catch (sendError) {
      if (abortController.signal.aborted) {
        if (responseConversationId) {
          setConversationId(responseConversationId)
          await loadConversations()
        }

        setStatus("idle")
        return
      }

      if (responseConversationId) {
        setConversationId(responseConversationId)
        await loadConversations()
      }

      setError(sendError instanceof Error ? sendError.message : "De AI-chat kon niet antwoorden")
      setStatus("error")
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] min-h-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-[width] duration-200",
          historyOpen ? "w-72" : "w-0 overflow-hidden",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Gesprekken</p>
            <p className="text-xs text-slate-500">Vacaturepublicatie AI</p>
          </div>
          <Button size="icon" variant="ghost" onClick={startNewConversation} aria-label="Nieuw gesprek">
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void loadConversation(conversation.id)}
              className={cn(
                "mb-1 w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-white",
                conversation.id === conversationId && "bg-white shadow-sm ring-1 ring-slate-200",
              )}
            >
              <span className="block truncate text-sm font-medium text-slate-900">
                {toConversationTitle(conversation)}
              </span>
              <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Clock className="size-3" />
                {formatRelativeDate(conversation.updatedAt)}
              </span>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-sm text-slate-500">
              Nog geen opgeslagen gesprekken.
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-slate-100/70">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setHistoryOpen((value) => !value)}
              aria-label={historyOpen ? "Gesprekken verbergen" : "Gesprekken tonen"}
            >
              {historyOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-950">
                {activeConversation ? toConversationTitle(activeConversation) : "AI publicatiechat"}
              </h1>
              <p className="truncate text-xs text-slate-500">
                Vraag om controles, publicatiestatus en read-only analyses voor vacatures.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 rounded-md">
            <Sparkles className="size-3 text-orange-500" />
            Claude
          </Badge>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {visibleMessages.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Waar wil je publicatiehulp bij?</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                      Stel een vraag over vacatures, platforms of publicatiechecks. De assistent toont welke tools zijn gebruikt.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setInput(prompt)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              visibleMessages.map((message) => <ChatMessage key={message.id} message={message} />)
            )}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                De assistent werkt...
              </div>
            )}
            {error && (
              <div className="max-w-2xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <form onSubmit={(event) => void sendMessage(event)} className="shrink-0 border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Vraag bijvoorbeeld: controleer of vacature 123 klaar is voor publicatie..."
              className="min-h-[48px] resize-none bg-white"
              disabled={busy}
            />
            <Button type="submit" disabled={busy || input.trim().length === 0} className="h-12 gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Verstuur
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
