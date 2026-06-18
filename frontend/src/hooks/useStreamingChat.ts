import { createSseConnection } from "@/lib/sseClient"
import { useResumeStore } from "@/stores/useResumeStore"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { useDiffStore } from "@/stores/useDiffStore"

export interface UseStreamingChatOptions {
  onDone?: (summary: string) => void
  onError?: (detail: string) => void
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const addMessage = useChatStore((state) => state.addMessage)
  const setStreaming = useChatStore((state) => state.setStreaming)
  const applyPatch = useResumeStore((state) => state.applyPatch)

  function startStream(url: string): () => void {
    setStreaming(true)

    // Start with an empty assistant message that tokens will be appended to
    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const closeConnection = createSseConnection(url, {
      onToken: ({ token }) => {
        // Append token to the assistant message content in useChatStore
        useChatStore.setState((state) => ({
          ...state,
          messages: state.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m
          ),
        }))
      },
      onPatch: (patch) => {
        // Dispatch patch to useResumeStore — AC5
        applyPatch(patch)
      },
      onDone: ({ summary }) => {
        setStreaming(false)
        options.onDone?.(summary)
      },
      onError: ({ detail }) => {
        setStreaming(false)
        options.onError?.(detail)
      },
    })

    // F5: ensure isStreaming is cleared on early cleanup (e.g. component unmount before done/error fires)
    function cleanup() {
      closeConnection()
      setStreaming(false)
    }

    return cleanup
  }

  function startStreamWithPost(url: string, body: Record<string, unknown>): () => void {
    setStreaming(true)

    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const token = useAuthStore.getState().token
    let cancelled = false
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setStreaming(false)
          options.onError?.("AI features are temporarily unavailable")
          return
        }
        const reader = res.body.getReader()
        activeReader = reader
        const decoder = new TextDecoder()
        let buffer = ""
        let eventName = ""
        let dataLine = ""

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim()
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim()
            } else if (line === "") {
              if (eventName && dataLine) {
                try {
                  const parsed = JSON.parse(dataLine) as Record<string, unknown>
                  if (eventName === "token") {
                    useChatStore.setState((state) => ({
                      ...state,
                      messages: state.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + (parsed.token as string) }
                          : m
                      ),
                    }))
                  } else if (eventName === "patch") {
                    applyPatch(parsed as { sectionId: string; itemIndex: number; field: string; newValue: string })
                  } else if (eventName === "done") {
                    setStreaming(false)
                    options.onDone?.((parsed.summary as string) ?? "")
                  } else if (eventName === "error") {
                    setStreaming(false)
                    options.onError?.((parsed.detail as string) ?? "AI streaming error — please try again")
                  }
                } catch {
                  // malformed JSON — ignore
                }
              }
              // F4: always reset on blank line to prevent stale field bleed-through
              eventName = ""
              dataLine = ""
            }
          }
        }
        // F3: flush remaining buffer content when stream ends without a trailing newline
        if (!cancelled && buffer.trim()) {
          const line = buffer.trim()
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim()
          }
          if (eventName && dataLine) {
            try {
              const parsed = JSON.parse(dataLine) as Record<string, unknown>
              if (eventName === "token") {
                useChatStore.setState((state) => ({
                  ...state,
                  messages: state.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + (parsed.token as string) }
                      : m
                  ),
                }))
              } else if (eventName === "patch") {
                applyPatch(parsed as { sectionId: string; itemIndex: number; field: string; newValue: string })
              } else if (eventName === "done") {
                setStreaming(false)
                options.onDone?.((parsed.summary as string) ?? "")
              } else if (eventName === "error") {
                setStreaming(false)
                options.onError?.((parsed.detail as string) ?? "AI streaming error — please try again")
              }
            } catch {
              // malformed JSON — ignore
            }
          }
        }
        if (!cancelled) setStreaming(false)
      })
      .catch(() => {
        if (!cancelled) {
          setStreaming(false)
          options.onError?.("AI streaming error — please try again")
        }
      })

    function cleanup() {
      cancelled = true
      // F1: cancel the underlying ReadableStream reader to release the network connection
      activeReader?.cancel().catch(() => {})
      setStreaming(false)
    }
    return cleanup
  }

  function startEnhanceStream(resumeId: string): () => void {
    setStreaming(true)

    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const token = useAuthStore.getState().token
    let cancelled = false
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null

    fetch("/api/v1/ai/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resumeId }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setStreaming(false)
          options.onError?.("AI features are temporarily unavailable")
          return
        }
        const reader = res.body.getReader()
        activeReader = reader
        const decoder = new TextDecoder()
        let buffer = ""
        let eventName = ""
        let dataLine = ""

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim()
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim()
            } else if (line === "") {
              if (eventName && dataLine) {
                try {
                  const parsed = JSON.parse(dataLine) as Record<string, unknown>
                  if (eventName === "token") {
                    useChatStore.setState((state) => ({
                      ...state,
                      messages: state.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + (parsed.token as string) }
                          : m
                      ),
                    }))
                  } else if (eventName === "patch") {
                    const patchEvent = parsed as {
                      sectionId: string
                      itemIndex: number
                      field: string
                      newValue: string
                    }
                    // Capture previousValue BEFORE applying the patch
                    const resumeState = useResumeStore.getState()
                    const sections = resumeState.currentResume?.content.sections ?? []
                    const section = sections.find(
                      (s) => s.sectionType === patchEvent.sectionId
                    )
                    const item = section?.items[patchEvent.itemIndex]
                    const previousValue = item
                      ? ((item as Record<string, unknown>)[patchEvent.field] as string) ?? ""
                      : ""

                    // Add diff entry BEFORE applying patch
                    const diffId = crypto.randomUUID()
                    const kind = previousValue ? "rewrite" : "addition"
                    useDiffStore.getState().addDiff({
                      id: diffId,
                      sectionId: patchEvent.sectionId,
                      itemIndex: patchEvent.itemIndex,
                      field: patchEvent.field,
                      newValue: patchEvent.newValue,
                      previousValue,
                      kind,
                      state: "visible",
                    })

                    // Then apply the patch (live update to ResumeCanvas)
                    applyPatch(patchEvent)
                  } else if (eventName === "done") {
                    setStreaming(false)
                    options.onDone?.((parsed.summary as string) ?? "")
                  } else if (eventName === "error") {
                    setStreaming(false)
                    options.onError?.(
                      (parsed.detail as string) ?? "AI streaming error — please try again"
                    )
                  }
                } catch {
                  // malformed JSON — ignore
                }
              }
              eventName = ""
              dataLine = ""
            }
          }
        }
        // Flush remaining buffer content when stream ends without trailing newline
        if (!cancelled && buffer.trim()) {
          const line = buffer.trim()
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim()
          }
          if (eventName && dataLine) {
            try {
              const parsed = JSON.parse(dataLine) as Record<string, unknown>
              if (eventName === "token") {
                useChatStore.setState((state) => ({
                  ...state,
                  messages: state.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + (parsed.token as string) }
                      : m
                  ),
                }))
              } else if (eventName === "patch") {
                const patchEvent = parsed as {
                  sectionId: string
                  itemIndex: number
                  field: string
                  newValue: string
                }
                const resumeState = useResumeStore.getState()
                const sections = resumeState.currentResume?.content.sections ?? []
                const section = sections.find(
                  (s) => s.sectionType === patchEvent.sectionId
                )
                const item = section?.items[patchEvent.itemIndex]
                const previousValue = item
                  ? ((item as Record<string, unknown>)[patchEvent.field] as string) ?? ""
                  : ""
                const diffId = crypto.randomUUID()
                const kind = previousValue ? "rewrite" : "addition"
                useDiffStore.getState().addDiff({
                  id: diffId,
                  sectionId: patchEvent.sectionId,
                  itemIndex: patchEvent.itemIndex,
                  field: patchEvent.field,
                  newValue: patchEvent.newValue,
                  previousValue,
                  kind,
                  state: "visible",
                })
                applyPatch(patchEvent)
              } else if (eventName === "done") {
                setStreaming(false)
                options.onDone?.((parsed.summary as string) ?? "")
              } else if (eventName === "error") {
                setStreaming(false)
                options.onError?.(
                  (parsed.detail as string) ?? "AI streaming error — please try again"
                )
              }
            } catch {
              // malformed JSON — ignore
            }
          }
        }
        if (!cancelled) setStreaming(false)
      })
      .catch(() => {
        if (!cancelled) {
          setStreaming(false)
          options.onError?.("AI streaming error — please try again")
        }
      })

    function cleanup() {
      cancelled = true
      activeReader?.cancel().catch(() => {})
      setStreaming(false)
    }
    return cleanup
  }

  return { startStream, startStreamWithPost, startEnhanceStream }
}
