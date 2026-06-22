import { createSseConnection } from "@/lib/sseClient"
import { useResumeStore } from "@/stores/useResumeStore"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { useDiffStore } from "@/stores/useDiffStore"
import { apiClient } from "@/lib/apiClient"
import type { PatchDiff, ResumeDto } from "@/types/api"

export interface UseStreamingChatOptions {
  onDone?: (summary: string) => void
  onError?: (detail: string) => void
}

type PatchEvent = {
  sectionId: string
  op?: string
  itemIndex?: number
  field?: string
  newValue?: string
  item?: Record<string, unknown>
}

type ModifyPatch = { sectionId: string; itemIndex: number; field: string; newValue: string }

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
  pendingDiffs: PatchDiff[],
  applyPatch: (patch: ModifyPatch) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (eventName === "token") {
    appendTokenToMessage(assistantMsgId, parsed.token as string)
  } else if (eventName === "patch") {
    applyEnhancePatch(parsed as PatchEvent, pendingDiffs, applyPatch)
  } else if (eventName === "done") {
    if (pendingDiffs.length > 0) {
      useChatStore.getState().updateMessage(assistantMsgId, { type: "patch", diffs: [...pendingDiffs] })
    }
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
  pendingDiffs: PatchDiff[],
  applyPatch: (patch: ModifyPatch) => void,
  setStreaming: (v: boolean) => void,
  options: UseStreamingChatOptions
): void {
  if (!eventName || !dataLine) return
  try {
    const parsed = JSON.parse(dataLine) as Record<string, unknown>
    handleBasicSseEvent(eventName, parsed, assistantMsgId, pendingDiffs, applyPatch, setStreaming, options)
  } catch {
    // malformed JSON — ignore
  }
}

/** Apply an enhance patch event including diff store registration. */
function applyEnhancePatch(patchEvent: PatchEvent, pendingDiffs: PatchDiff[], applyPatch: (patch: ModifyPatch) => void): void {
  const op = patchEvent.op ?? "modify"
  const resumeStore = useResumeStore.getState()
  const diffId = crypto.randomUUID()

  if (op === "add") {
    const item = patchEvent.item
    if (!item) return
    const sectionType = patchEvent.sectionId as Parameters<typeof resumeStore.addItem>[0]
    useDiffStore.getState().addDiff({
      id: diffId,
      sectionId: patchEvent.sectionId,
      itemIndex: -1,
      field: "",
      newValue: JSON.stringify(item),
      previousValue: "",
      kind: "addition",
      state: "visible",
    })
    pendingDiffs.push({ kind: "addition", sectionId: patchEvent.sectionId, field: "", newValue: JSON.stringify(item) })
    const sections = resumeStore.currentResume?.content.sections ?? []
    const section = sections.find((s) => s.sectionType === patchEvent.sectionId)
    const insertAt = patchEvent.itemIndex ?? (section?.items.length ?? 0)
    resumeStore.addItem(sectionType, insertAt)
    return
  }

  if (op === "delete") {
    const sections = resumeStore.currentResume?.content.sections ?? []
    const section = sections.find((s) => s.sectionType === patchEvent.sectionId)
    const idx = patchEvent.itemIndex ?? -1
    const deletedItem = section?.items[idx]
    if (!deletedItem) return
    useDiffStore.getState().addDiff({
      id: diffId,
      sectionId: patchEvent.sectionId,
      itemIndex: idx,
      field: "",
      newValue: "",
      previousValue: JSON.stringify(deletedItem),
      kind: "deletion",
      state: "visible",
    })
    pendingDiffs.push({ kind: "deletion", sectionId: patchEvent.sectionId, field: "", newValue: "" })
    resumeStore.deleteItem(patchEvent.sectionId as Parameters<typeof resumeStore.deleteItem>[0], deletedItem.id)
    return
  }

  const sections = resumeStore.currentResume?.content.sections ?? []
  const section = sections.find((s) => s.sectionType === patchEvent.sectionId)
  const item = section?.items[patchEvent.itemIndex ?? -1]
  const field = patchEvent.field ?? ""
  const newValue = patchEvent.newValue ?? ""
  const previousValue = item
    ? ((item as unknown as Record<string, unknown>)[field] as string) ?? ""
    : ""

  const kind = previousValue ? "rewrite" : "addition"
  useDiffStore.getState().addDiff({
    id: diffId,
    sectionId: patchEvent.sectionId,
    itemIndex: patchEvent.itemIndex ?? -1,
    field,
    newValue,
    previousValue,
    kind,
    state: "visible",
  })

  pendingDiffs.push({ kind, sectionId: patchEvent.sectionId, field, newValue })

  applyPatch({ sectionId: patchEvent.sectionId, itemIndex: patchEvent.itemIndex ?? -1, field, newValue })
}


/** Process all complete SSE lines from a buffer chunk, returning the remaining partial line.
 *  `dispatchFn` is called for each complete event (blank-line separator). */
function processBuffer(
  buffer: string,
  newChunk: string,
  state: { eventName: string; dataLine: string },
  dispatchFn: (eventName: string, dataLine: string) => void
): { remaining: string; eventName: string; dataLine: string } {
  const combined = buffer + newChunk
  const lines = combined.split("\n")
  const remaining = lines.pop() ?? ""

  let { eventName, dataLine } = state
  for (const line of lines) {
    if (line === "") {
      dispatchFn(eventName, dataLine)
      // always reset on blank line to prevent stale field bleed-through
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
    const pendingDiffs: PatchDiff[] = []

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
          const result = processBuffer(buffer, chunk, sseState, (en, dl) =>
            dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, options)
          )
          buffer = result.remaining
          sseState = { eventName: result.eventName, dataLine: result.dataLine }
        }

        // F3: flush remaining buffer content when stream ends without a trailing newline
        if (!ref.cancelled && buffer.trim()) {
          const { eventName: en, dataLine: dl } = parseSseLine(buffer.trim(), sseState.eventName, sseState.dataLine)
          dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, options)
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

  function startEnhanceStream(resumeId: string, conversationId?: string): () => void {
    setStreaming(true)

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: "Enhance my resume",
      timestamp: new Date().toISOString(),
    })

    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const token = useAuthStore.getState().token
    const ref: CancelRef = { cancelled: false, reader: null }
    const pendingDiffs: PatchDiff[] = []

    fetch("/api/v1/ai/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resumeId, ...(conversationId ? { conversationId } : {}) }),
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
          const result = processBuffer(buffer, chunk, sseState, (en, dl) =>
            dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, options)
          )
          buffer = result.remaining
          sseState = { eventName: result.eventName, dataLine: result.dataLine }
        }

        // Flush remaining buffer content when stream ends without trailing newline
        if (!ref.cancelled && buffer.trim()) {
          const { eventName: en, dataLine: dl } = parseSseLine(buffer.trim(), sseState.eventName, sseState.dataLine)
          dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, options)
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

  async function markResumeAsTailored(resumeId: string): Promise<void> {
    try {
      await apiClient.patch<ResumeDto>(`/api/v1/resumes/${resumeId}/tailor`)
      useResumeStore.getState().setCurrentResumeTailored(true, resumeId)
    } catch (err) {
      // Non-critical — badge is cosmetic; log for visibility but do not surface to user
      console.warn("markResumeAsTailored: PATCH failed", err)
    }
  }

  function startTailorStream(resumeId: string, jobDescription: string, conversationId?: string): () => void {
    setStreaming(true)

    const snippet = jobDescription.length > 80 ? jobDescription.slice(0, 80) + "…" : jobDescription
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `Tailor my resume to: ${snippet}`,
      timestamp: new Date().toISOString(),
    })

    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const authToken = useAuthStore.getState().token
    const ref: CancelRef = { cancelled: false, reader: null }
    const pendingDiffs: PatchDiff[] = []
    // F4: track whether a successful `done` SSE event was received
    let tailorDoneReceived = false
    const tailorOptions: UseStreamingChatOptions = {
      ...options,
      onDone: (summary) => {
        tailorDoneReceived = true
        options.onDone?.(summary)
      },
    }

    fetch("/api/v1/ai/tailor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ resumeId, jobDescription, ...(conversationId ? { conversationId } : {}) }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setStreaming(false)
          // F6: match AC7 error message text exactly
          options.onError?.("AI features are temporarily unavailable — try again later")
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
          const result = processBuffer(buffer, chunk, sseState, (en, dl) =>
            dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, tailorOptions)
          )
          buffer = result.remaining
          sseState = { eventName: result.eventName, dataLine: result.dataLine }
        }

        // Flush remaining buffer content when stream ends without trailing newline
        if (!ref.cancelled && buffer.trim()) {
          const { eventName: en, dataLine: dl } = parseSseLine(buffer.trim(), sseState.eventName, sseState.dataLine)
          dispatchBasicEvent(en, dl, assistantMsgId, pendingDiffs, applyPatch, setStreaming, tailorOptions)
        }
        // F4: only mark as tailored when the SSE `done` event was received (not on `error`)
        if (!ref.cancelled && tailorDoneReceived) {
          await markResumeAsTailored(resumeId)
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

  return { startStream, startStreamWithPost, startEnhanceStream, startTailorStream }
}
