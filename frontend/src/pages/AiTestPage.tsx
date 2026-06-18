import { useRef, useState } from "react"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"

/**
 * Dev-only spike test harness for AI streaming (Story 5.1).
 *
 * Uses fetch + ReadableStream instead of EventSource because:
 * - The backend endpoint is POST /api/v1/ai/chat (requires a JSON body)
 * - Native EventSource only supports GET requests
 * - JWT Bearer token must be sent via Authorization header (EventSource does not support custom headers)
 *
 * See docs/ai-spike-findings.md for full reasoning.
 */
export default function AiTestPage() {
  const [prompt, setPrompt] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const assistantContent = useChatStore((state) =>
    state.messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n---\n")
  )
  const addMessage = useChatStore((state) => state.addMessage)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setDoneMsg(null)

    // Abort any previous stream
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const token = useAuthStore.getState().token
    setIsStreaming(true)

    // Add empty assistant message to accumulate tokens into
    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        setErrorMsg(errorData.detail ?? `HTTP ${res.status}`)
        setIsStreaming(false)
        return
      }

      // F6: guard against null body (e.g. HEAD responses or browser quirks)
      if (!res.body) {
        setErrorMsg("Stream unavailable — no response body")
        setIsStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        let eventName = ""
        let dataLine = ""

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim()
          } else if (line.startsWith("data:")) {
            dataLine = line.slice("data:".length).trim()
          } else if (line === "") {
            // F12: blank line always marks end of SSE event block — reset unconditionally
            if (eventName && dataLine) {
              // Dispatch the accumulated event
              try {
                const parsed = JSON.parse(dataLine)
                if (eventName === "token") {
                  useChatStore.setState((state) => ({
                    ...state,
                    messages: state.messages.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: m.content + (parsed.token as string) }
                        : m
                    ),
                  }))
                } else if (eventName === "done") {
                  setDoneMsg(parsed.summary as string)
                } else if (eventName === "error") {
                  setErrorMsg(parsed.detail as string)
                }
              } catch {
                // ignore malformed SSE data lines
              }
            }
            eventName = ""
            dataLine = ""
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setErrorMsg(err.message)
      }
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Streaming Spike — Test Harness</h1>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 flex-1"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt..."
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isStreaming || !prompt.trim()}
        >
          {isStreaming ? "Streaming..." : "Send"}
        </button>
      </form>
      {errorMsg && (
        <div className="text-red-600 mb-2">Error: {errorMsg}</div>
      )}
      {doneMsg && (
        <div className="text-green-600 mb-2">Done: {doneMsg}</div>
      )}
      <textarea
        readOnly
        className="w-full h-64 border rounded p-3 font-mono text-sm"
        value={assistantContent}
      />
    </div>
  )
}
