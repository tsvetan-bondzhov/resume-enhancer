import { createSseConnection } from "@/lib/sseClient"
import { useResumeStore } from "@/stores/useResumeStore"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { useDiffStore } from "@/stores/useDiffStore"

export interface UseStreamingChatOptions {
  onDone?: (summary: string) => void
  onError?: (detail: string) => void
}

type PatchEvent = { sectionId: string; itemIndex: number; field: string; newValue: string }

/** Parse a single SSE line, updating eventName/dataLine accumulators. */
function parseSseLine(
  line: string,
  eventName: string,
  dataLine: string
): { eventName: string; dataLine: string } {
  if (line.startsWith("event:")) {
    return { eventName: line.slice(6).trim(), dataLine }
  }
  if (line.startsWith("data:")) {
    return { eventName, dataLine: line.slice(5).trim() }
  }
  return { eventName, dataLine }
}

/** Append a token to an existing assistant message in useChatStore. */
function appendTokenToMessage(assistantMsgId: string, token: string): void {
  useChatStore.setState((state) => ({
    ...state,
    messages: state.messages.map((m) =>
      m.id === assistantMsgId ? { ...m, content: m.content + token } : m
    ),
  }))
}

/** Handle a complete SSE event for the basic post streaming (no diff tracking). */
function handleBasicSseEvent(
  eventName: string,
  parsed: Record<string, unknown>,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (eventName === "token") {
    appendTokenToMessage(assistantMsgId, parsed.token as string)
  } else if (eventName === "patch") {
    applyPatch(parsed as PatchEvent)
  } else if (eventName === "done") {
    setStreaming(false)
    options.onDone?.((parsed.summary as string) ?? "")
  } else if (eventName === "error") {
    setStreaming(false)
    options.onError?.((parsed.detail as string) ?? "AI streaming error — please try again")
  }
}

/** Dispatch one complete SSE event block for the basic post stream. */
function dispatchBasicEvent(
  eventName: string,
  dataLine: string,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (!eventName || !dataLine) return
  try {
    const parsed = JSON.parse(dataLine) as Record<string, unknown>
    handleBasicSseEvent(eventName, parsed, assistantMsgId, applyPatch, setStreaming, options)
  } catch {
    // malformed JSON — ignore
  }
}

/** Process SSE lines for the enhance stream including diff tracking. */
function handleEnhanceSseEvent(
  eventName: string,
  parsed: Record<string, unknown>,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (eventName === "token") {
    appendTokenToMessage(assistantMsgId, parsed.token as string)
  } else if (eventName === "patch") {
    applyEnhancePatch(parsed as PatchEvent, applyPatch)
  } else if (eventName === "done") {
    setStreaming(false)
    options.onDone?.((parsed.summary as string) ?? "")
  } else if (eventName === "error") {
    setStreaming(false)
    options.onError?.((parsed.detail as string) ?? "AI streaming error — please try again")
  }
}

/** Apply an enhance patch event including diff store registration. */
function applyEnhancePatch(patchEvent: PatchEvent, applyPatch: (patch: PatchEvent) => void): void {
  // Capture previousValue BEFORE applying the patch
  const resumeState = useResumeStore.getState()
  const sections = resumeState.currentResume?.content.sections ?? []
  const section = sections.find((s) => s.sectionType === patchEvent.sectionId)
  const item = section?.items[patchEvent.itemIndex]
  const previousValue = item
    ? ((item as unknown as Record<string, unknown>)[patchEvent.field] as string) ?? ""
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
}

/** Dispatch one complete SSE event block for the enhance stream. */
function dispatchEnhanceEvent(
  eventName: string,
  dataLine: string,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (!eventName || !dataLine) return
  try {
    const parsed = JSON.parse(dataLine) as Record<string, unknown>
    handleEnhanceSseEvent(eventName, parsed, assistantMsgId, applyPatch, setStreaming, options)
  } catch {
    // malformed JSON — ignore
  }
}

/** Process all complete SSE lines from a buffer chunk, returning the remaining partial line. */
function processBasicBuffer(
  buffer: string,
  newChunk: string,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions,
  state: { eventName: string; dataLine: string }
): { remaining: string; eventName: string; dataLine: string } {
  const combined = buffer + newChunk
  const lines = combined.split("\n")
  const remaining = lines.pop() ?? ""

  let { eventName, dataLine } = state
  for (const line of lines) {
    if (line === "") {
      dispatchBasicEvent(eventName, dataLine, assistantMsgId, applyPatch, setStreaming, options)
      // F4: always reset on blank line to prevent stale field bleed-through
      eventName = ""
      dataLine = ""
    } else {
      const updated = parseSseLine(line, eventName, dataLine)
      eventName = updated.eventName
      dataLine = updated.dataLine
    }
  }
  return { remaining, eventName, dataLine }
}

/** Process all complete SSE lines from a buffer chunk for the enhance stream. */
function processEnhanceBuffer(
  buffer: string,
  newChunk: string,
  assistantMsgId: string,
  applyPatch: (patch: PatchEvent) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions,
  state: { eventName: string; dataLine: string }
): { remaining: string; eventName: string; dataLine: string } {
  const combined = buffer + newChunk
  const lines = combined.split("\n")
  const remaining = lines.pop() ?? ""

  let { eventName, dataLine } = state
  for (const line of lines) {
    if (line === "") {
      dispatchEnhanceEvent(eventName, dataLine, assistantMsgId, applyPatch, setStreaming, options)
      eventName = ""
      dataLine = ""
    } else {
      const updated = parseSseLine(line, eventName, dataLine)
      eventName = updated.eventName
      dataLine = updated.dataLine
    }
  }
  return { remaining, eventName, dataLine }
}

type CancelRef = { cancelled: boolean; reader: ReadableStreamDefaultReader<Uint8Array> | null }

function makeStreamCleanup(ref: CancelRef, stopStreaming: () => void): () => void {
  return () => {
    ref.cancelled = true
    ref.reader?.cancel().catch(() => {})
    stopStreaming()
  }
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
        appendTokenToMessage(assistantMsgId, token)
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
    const ref: CancelRef = { cancelled: false, reader: null }

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
        ref.reader = reader
        const decoder = new TextDecoder()
        let buffer = ""
        let sseState = { eventName: "", dataLine: "" }

        while (!ref.cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const result = processBasicBuffer(
            buffer, chunk, assistantMsgId, applyPatch, setStreaming, options, sseState
          )
          buffer = result.remaining
          sseState = { eventName: result.eventName, dataLine: result.dataLine }
        }

        // F3: flush remaining buffer content when stream ends without a trailing newline
        if (!ref.cancelled && buffer.trim()) {
          const { eventName: en, dataLine: dl } = parseSseLine(buffer.trim(), sseState.eventName, sseState.dataLine)
          dispatchBasicEvent(en, dl, assistantMsgId, applyPatch, setStreaming, options)
        }
        if (!ref.cancelled) setStreaming(false)
      })
      .catch(() => {
        if (!ref.cancelled) {
          setStreaming(false)
          options.onError?.("AI streaming error — please try again")
        }
      })

    return makeStreamCleanup(ref, () => setStreaming(false))
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
    const ref: CancelRef = { cancelled: false, reader: null }

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
        ref.reader = reader
        const decoder = new TextDecoder()
        let buffer = ""
        let sseState = { eventName: "", dataLine: "" }

        while (!ref.cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const result = processEnhanceBuffer(
            buffer, chunk, assistantMsgId, applyPatch, setStreaming, options, sseState
          )
          buffer = result.remaining
          sseState = { eventName: result.eventName, dataLine: result.dataLine }
        }

        // Flush remaining buffer content when stream ends without trailing newline
        if (!ref.cancelled && buffer.trim()) {
          const { eventName: en, dataLine: dl } = parseSseLine(buffer.trim(), sseState.eventName, sseState.dataLine)
          dispatchEnhanceEvent(en, dl, assistantMsgId, applyPatch, setStreaming, options)
        }
        if (!ref.cancelled) setStreaming(false)
      })
      .catch(() => {
        if (!ref.cancelled) {
          setStreaming(false)
          options.onError?.("AI streaming error — please try again")
        }
      })

    return makeStreamCleanup(ref, () => setStreaming(false))
  }

  return { startStream, startStreamWithPost, startEnhanceStream }
}
