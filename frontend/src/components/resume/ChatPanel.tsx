import { useEffect, useRef, useState } from "react"
import { useChatStore } from "@/stores/useChatStore"
import { useStreamingChat } from "@/hooks/useStreamingChat"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/types/api"

export interface ChatPanelProps {
  readonly resumeId: string | undefined
}

function MessageBubble({ message }: { readonly message: ChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {message.content}
      </div>
      <span className="text-xs text-muted-foreground mt-1 px-1">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  )
}

export default function ChatPanel({ resumeId }: ChatPanelProps) {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const addMessage = useChatStore((state) => state.addMessage)

  const [inputValue, setInputValue] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string>("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  // AC3: session-scoped conversationId — stable across re-renders, new on each component mount (AC4)
  const conversationIdRef = useRef<string>(crypto.randomUUID())

  const { startStreamWithPost } = useStreamingChat({
    onDone: (summary) => {
      setErrorMessage(null)
      // F9: AC5 — display the done summary as an inline assistant bubble
      if (summary) {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: summary,
          timestamp: new Date().toISOString(),
        })
      }
      inputRef.current?.focus()
    },
    onError: (detail) => {
      setErrorMessage(detail)
    },
  })

  // Auto-scroll to latest message when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  function handleSubmit() {
    const prompt = inputValue.trim()
    if (!prompt || isStreaming) return

    setErrorMessage(null)
    setLastPrompt(prompt)
    setInputValue("")

    // Add user message to store
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    })

    // Start the SSE POST stream — hook manages the assistant message
    const cleanup = startStreamWithPost("/api/v1/ai/chat", {
      prompt,
      resumeId: resumeId ?? null,
      conversationId: conversationIdRef.current,  // AC3: consistent per session
    })
    cleanupRef.current = cleanup
  }

  function handleRetry() {
    // F5: guard against retry while a stream is already active; cancel prior stream first
    if (isStreaming) return
    cleanupRef.current?.()
    cleanupRef.current = null

    setErrorMessage(null)
    if (!lastPrompt) return

    // Add the last user message again
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: lastPrompt,
      timestamp: new Date().toISOString(),
    })

    const cleanup = startStreamWithPost("/api/v1/ai/chat", {
      prompt: lastPrompt,
      resumeId: resumeId ?? null,
      conversationId: conversationIdRef.current,  // AC3: consistent per session
    })
    cleanupRef.current = cleanup
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Message list */}
      <div
        role="log"
        aria-live="polite"
        aria-label="AI conversation"
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
      >
        {messages.length === 0 && !isStreaming && !errorMessage && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Ask the AI to improve your resume
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
            <span
              className="inline-block h-2 w-2 rounded-full bg-blue-400 motion-safe:animate-pulse"
              aria-hidden="true"
            />
            <span>AI is thinking…</span>
          </div>
        )}

        {errorMessage !== null && (
          <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="text-destructive mb-2">AI is offline — check your Ollama connection</p>
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isStreaming}>
              Retry
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="flex flex-col gap-2"
        >
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI to improve your resume…"
            disabled={isStreaming}
            className="resize-none text-sm min-h-[72px]"
            rows={3}
            aria-label="Chat message input"
          />
          <Button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="self-end"
            size="sm"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
