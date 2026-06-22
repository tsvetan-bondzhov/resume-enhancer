import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStreamingChat } from "./useStreamingChat"
import { useChatStore } from "@/stores/useChatStore"
import { useResumeStore } from "@/stores/useResumeStore"
import { useDiffStore } from "@/stores/useDiffStore"
import { useAuthStore } from "@/stores/useAuthStore"
import * as sseModule from "@/lib/sseClient"

// Mock sseClient so we control what events fire
vi.mock("@/lib/sseClient")

// Mock apiClient used in markResumeAsTailored
vi.mock("@/lib/apiClient", () => ({
  apiClient: { patch: vi.fn().mockResolvedValue({}) },
}))

// Helper: build a ReadableStream from a list of SSE string chunks
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let idx = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(chunks[idx++]))
      } else {
        controller.close()
      }
    },
  })
}

function mockFetchOk(chunks: string[]) {
  const stream = makeStream(chunks)
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    })
  )
}

function mockFetchNotOk(status = 500) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      body: null,
    })
  )
}

function mockFetchError(message = "network error") {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(message)))
}

describe("useStreamingChat", () => {
  let capturedHandlers: Parameters<typeof sseModule.createSseConnection>[1]

  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false })
    useDiffStore.setState({ diffs: [] })
    useAuthStore.setState({ token: null, user: null })
    // Reset applyPatch to a spy
    vi.spyOn(useResumeStore.getState(), "applyPatch")

    vi.mocked(sseModule.createSseConnection).mockImplementation((_url, handlers) => {
      capturedHandlers = handlers
      return vi.fn() // cleanup fn
    })

    vi.unstubAllGlobals()
  })

  it("adds an assistant message and sets isStreaming on startStream", () => {
    const { result } = renderHook(() => useStreamingChat())
    act(() => { result.current.startStream("/api/v1/ai/chat") })

    expect(useChatStore.getState().isStreaming).toBe(true)
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0].role).toBe("assistant")
  })

  it("appends tokens to the assistant message", () => {
    const { result } = renderHook(() => useStreamingChat())
    act(() => { result.current.startStream("/api/v1/ai/chat") })

    act(() => {
      capturedHandlers.onToken({ token: "Hello" })
      capturedHandlers.onToken({ token: " world" })
    })

    expect(useChatStore.getState().messages[0].content).toBe("Hello world")
  })

  it("dispatches patch events to useResumeStore.applyPatch", () => {
    const applyPatchSpy = vi.spyOn(useResumeStore.getState(), "applyPatch")
    const { result } = renderHook(() => useStreamingChat())
    act(() => { result.current.startStream("/api/v1/ai/chat") })

    const patch = { sectionId: "WORK_EXPERIENCE", itemIndex: 0, field: "jobTitle", newValue: "Engineer" }
    act(() => { capturedHandlers.onPatch(patch) })

    expect(applyPatchSpy).toHaveBeenCalledWith(patch)
  })

  it("clears isStreaming on done event", () => {
    const onDone = vi.fn()
    const { result } = renderHook(() => useStreamingChat({ onDone }))
    act(() => { result.current.startStream("/api/v1/ai/chat") })

    act(() => { capturedHandlers.onDone({ summary: "Done!" }) })

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(onDone).toHaveBeenCalledWith("Done!")
  })

  it("clears isStreaming on error event", () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useStreamingChat({ onError }))
    act(() => { result.current.startStream("/api/v1/ai/chat") })

    act(() => { capturedHandlers.onError({ detail: "AI offline" }) })

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(onError).toHaveBeenCalledWith("AI offline")
  })

  // ─── startStreamWithPost ───────────────────────────────────────────────────

  describe("startStreamWithPost", () => {
    it("sets isStreaming and adds an assistant message immediately", () => {
      mockFetchOk([])
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" }) })

      expect(useChatStore.getState().isStreaming).toBe(true)
      expect(useChatStore.getState().messages).toHaveLength(1)
      expect(useChatStore.getState().messages[0].role).toBe("assistant")
    })

    it("processes token events and appends to the assistant message", async () => {
      const chunks = [
        "event: token\ndata: {\"token\": \"Hello\"}\n\n",
        "event: token\ndata: {\"token\": \" world\"}\n\n",
        "event: done\ndata: {\"summary\": \"ok\"}\n\n",
      ]
      mockFetchOk(chunks)
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(useChatStore.getState().messages[0].content).toBe("Hello world")
      expect(onDone).toHaveBeenCalledWith("ok")
    })

    it("processes patch events and calls applyPatch", async () => {
      const applyPatchSpy = vi.spyOn(useResumeStore.getState(), "applyPatch")
      const patchData = JSON.stringify({ sectionId: "WORK_EXPERIENCE", itemIndex: 0, field: "jobTitle", newValue: "Senior Eng" })
      const chunks = [
        `event: patch\ndata: ${patchData}\n\n`,
        "event: done\ndata: {\"summary\": \"patched\"}\n\n",
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "update" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(applyPatchSpy).toHaveBeenCalledWith({
        sectionId: "WORK_EXPERIENCE",
        itemIndex: 0,
        field: "jobTitle",
        newValue: "Senior Eng",
      })
    })

    it("calls onError when server returns non-ok response", async () => {
      mockFetchNotOk()
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI features are temporarily unavailable")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on fetch network failure", async () => {
      mockFetchError("network error")
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI streaming error — please try again")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on error SSE event", async () => {
      const chunks = [
        "event: error\ndata: {\"detail\": \"Model not found\"}\n\n",
      ]
      mockFetchOk(chunks)
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("Model not found")
    })

    it("cleanup function cancels the stream and stops streaming", async () => {
      // Use a never-resolving stream to keep it open
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          body: new ReadableStream({ start() {} }),
        })
      )
      const { result } = renderHook(() => useStreamingChat())
      let cleanup: (() => void) | undefined

      act(() => {
        cleanup = result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
      })

      expect(useChatStore.getState().isStreaming).toBe(true)

      act(() => { cleanup?.() })

      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("includes Authorization header when token is set", async () => {
      useAuthStore.setState({ token: "my-jwt", user: null })
      mockFetchOk(["event: done\ndata: {\"summary\": \"ok\"}\n\n"])
      const mockFetch = vi.mocked(fetch)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "Hello" })
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/ai/chat",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer my-jwt" }),
        })
      )
    })
  })

  // ─── startEnhanceStream ────────────────────────────────────────────────────

  describe("startEnhanceStream", () => {
    it("sets isStreaming and adds an assistant message immediately", () => {
      mockFetchOk([])
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startEnhanceStream("resume-123") })

      expect(useChatStore.getState().isStreaming).toBe(true)
      expect(useChatStore.getState().messages).toHaveLength(2)
      expect(useChatStore.getState().messages[0].role).toBe("user")
      expect(useChatStore.getState().messages[1].role).toBe("assistant")
    })

    it("posts to /api/v1/ai/enhance with resumeId in body", async () => {
      mockFetchOk(["event: done\ndata: {\"summary\": \"enhanced\"}\n\n"])
      const mockFetch = vi.mocked(fetch)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startEnhanceStream("resume-abc")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/ai/enhance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resumeId: "resume-abc" }),
        })
      )
    })

    it("calls onDone after processing done event", async () => {
      const chunks = ["event: done\ndata: {\"summary\": \"enhanced!\"}\n\n"]
      mockFetchOk(chunks)
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onDone).toHaveBeenCalledWith("enhanced!")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError when server returns non-ok response", async () => {
      mockFetchNotOk()
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI features are temporarily unavailable")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on fetch network failure", async () => {
      mockFetchError("connection refused")
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI streaming error — please try again")
    })

    it("processes token events and appends to assistant message", async () => {
      const chunks = [
        "event: token\ndata: {\"token\": \"Enhance\"}\n\n",
        "event: token\ndata: {\"token\": \"d\"}\n\n",
        "event: done\ndata: {\"summary\": \"done\"}\n\n",
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(useChatStore.getState().messages[1].content).toBe("Enhanced")
    })

    it("processes patch events and registers diff + applies patch", async () => {
      const applyPatchSpy = vi.spyOn(useResumeStore.getState(), "applyPatch")
      const patchData = JSON.stringify({
        sectionId: "WORK_EXPERIENCE",
        itemIndex: 0,
        field: "description",
        newValue: "AI improved description",
      })
      const chunks = [
        `event: patch\ndata: ${patchData}\n\n`,
        "event: done\ndata: {\"summary\": \"done\"}\n\n",
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(applyPatchSpy).toHaveBeenCalledWith({
        sectionId: "WORK_EXPERIENCE",
        itemIndex: 0,
        field: "description",
        newValue: "AI improved description",
      })
      // A diff entry should have been registered in useDiffStore
      const diffs = useDiffStore.getState().diffs
      expect(diffs).toHaveLength(1)
      expect(diffs[0].newValue).toBe("AI improved description")
      expect(diffs[0].sectionId).toBe("WORK_EXPERIENCE")
    })

    it("cleanup function cancels the stream and stops streaming", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          body: new ReadableStream({ start() {} }),
        })
      )
      const { result } = renderHook(() => useStreamingChat())
      let cleanup: (() => void) | undefined

      act(() => {
        cleanup = result.current.startEnhanceStream("resume-123")
      })

      expect(useChatStore.getState().isStreaming).toBe(true)
      act(() => { cleanup?.() })
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on error SSE event", async () => {
      const chunks = [
        "event: error\ndata: {\"detail\": \"Enhance failed\"}\n\n",
      ]
      mockFetchOk(chunks)
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("Enhance failed")
    })

    it("processes malformed JSON chunk gracefully in flush path", async () => {
      // Feeds a chunk without trailing newline so processBuffer leaves it in the buffer,
      // then stream ends — flush path dispatches it (covers lines 341-343 flush block)
      const chunks = [
        "event: done\ndata: {\"summary\": \"enh",   // incomplete — no trailing newline
      ]
      // The stream ends mid-chunk; the flush remainder tries to parse it
      mockFetchOk(chunks)
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startEnhanceStream("resume-123")
        await new Promise((r) => setTimeout(r, 80))
      })

      // The partial JSON won't parse to a full event, but no exception should be thrown
      expect(useChatStore.getState().isStreaming).toBe(false)
    })
  })

  // ─── startTailorStream ────────────────────────────────────────────────────

  describe("startTailorStream", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("sets isStreaming and adds an assistant message immediately", () => {
      mockFetchOk([])
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startTailorStream("resume-tailor-1", "Senior Java Developer role") })

      expect(useChatStore.getState().isStreaming).toBe(true)
      expect(useChatStore.getState().messages).toHaveLength(2)
      expect(useChatStore.getState().messages[0].role).toBe("user")
      expect(useChatStore.getState().messages[1].role).toBe("assistant")
    })

    it("posts to /api/v1/ai/tailor with resumeId and jobDescription", async () => {
      mockFetchOk(["event: done\ndata: {\"summary\": \"tailored\"}\n\n"])
      const mockFetch = vi.mocked(fetch)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startTailorStream("resume-t1", "Backend engineer role")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/ai/tailor",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resumeId: "resume-t1", jobDescription: "Backend engineer role" }),
        })
      )
    })

    it("includes Authorization header when token is set", async () => {
      useAuthStore.setState({ token: "tailor-jwt", user: null })
      mockFetchOk(["event: done\ndata: {\"summary\": \"ok\"}\n\n"])
      const mockFetch = vi.mocked(fetch)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startTailorStream("resume-t2", "Job desc")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/ai/tailor",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer tailor-jwt" }),
        })
      )
    })

    it("calls onDone when done event is received", async () => {
      const chunks = ["event: done\ndata: {\"summary\": \"Tailoring complete\"}\n\n"]
      mockFetchOk(chunks)
      const onDone = vi.fn()

      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startTailorStream("resume-t3", "Description")
        await new Promise((r) => setTimeout(r, 100))
      })

      expect(onDone).toHaveBeenCalledWith("Tailoring complete")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError when server returns non-ok response", async () => {
      mockFetchNotOk(503)
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startTailorStream("resume-t4", "Job description")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI features are temporarily unavailable — try again later")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on fetch network failure", async () => {
      mockFetchError("ECONNREFUSED")
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startTailorStream("resume-t5", "Job description")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("AI streaming error — please try again")
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("calls onError on error SSE event", async () => {
      const chunks = [
        "event: error\ndata: {\"detail\": \"Tailor failed\"}\n\n",
      ]
      mockFetchOk(chunks)
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))

      await act(async () => {
        result.current.startTailorStream("resume-t6", "Job description")
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(onError).toHaveBeenCalledWith("Tailor failed")
    })

    it("processes token events and appends to assistant message", async () => {
      const chunks = [
        "event: token\ndata: {\"token\": \"Tailored\"}\n\n",
        "event: token\ndata: {\"token\": \"!\"}\n\n",
        "event: done\ndata: {\"summary\": \"done\"}\n\n",
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startTailorStream("resume-t7", "Job desc")
        await new Promise((r) => setTimeout(r, 80))
      })

      expect(useChatStore.getState().messages[1].content).toBe("Tailored!")
    })

    it("processes patch events and registers diff + applies patch", async () => {
      const applyPatchSpy = vi.spyOn(useResumeStore.getState(), "applyPatch")
      const patchData = JSON.stringify({
        sectionId: "WORK_EXPERIENCE",
        itemIndex: 0,
        field: "jobTitle",
        newValue: "AI Tailored Title",
      })
      const chunks = [
        `event: patch\ndata: ${patchData}\n\n`,
        "event: done\ndata: {\"summary\": \"tailored\"}\n\n",
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startTailorStream("resume-t8", "Job description")
        await new Promise((r) => setTimeout(r, 80))
      })

      expect(applyPatchSpy).toHaveBeenCalledWith({
        sectionId: "WORK_EXPERIENCE",
        itemIndex: 0,
        field: "jobTitle",
        newValue: "AI Tailored Title",
      })
      const diffs = useDiffStore.getState().diffs
      expect(diffs.length).toBeGreaterThan(0)
      expect(diffs[0].newValue).toBe("AI Tailored Title")
    })

    it("cleanup function cancels the stream and stops streaming", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          body: new ReadableStream({ start() {} }),
        })
      )
      const { result } = renderHook(() => useStreamingChat())
      let cleanup: (() => void) | undefined

      act(() => {
        cleanup = result.current.startTailorStream("resume-t9", "Job desc")
      })

      expect(useChatStore.getState().isStreaming).toBe(true)
      act(() => { cleanup?.() })
      expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it("flushes remaining buffer content when stream ends without trailing newline", async () => {
      // Covers lines 423-425: buffer.trim() is non-empty when stream ends
      const chunks = [
        "event: token\ndata: {\"token\": \"partial\"}",  // no trailing newline
      ]
      mockFetchOk(chunks)
      const { result } = renderHook(() => useStreamingChat())

      await act(async () => {
        result.current.startTailorStream("resume-t10", "Job description")
        await new Promise((r) => setTimeout(r, 80))
      })

      // Should have appended the token to the assistant message
      expect(useChatStore.getState().messages[1].content).toBe("partial")
    })
  })

  // ─── parseSseLine: no-match branch ───────────────────────────────────────

  describe("startStreamWithPost — buffer flush", () => {
    it("flushes remaining buffer when stream ends without trailing newline", async () => {
      // Covers lines 279-281 (startStreamWithPost flush) by sending incomplete SSE chunk
      const chunks = [
        "event: done\ndata: {\"summary\": \"flushed\"}",  // no trailing newline
      ]
      mockFetchOk(chunks)
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "test" })
        await new Promise((r) => setTimeout(r, 80))
      })

      expect(onDone).toHaveBeenCalledWith("flushed")
    })

    it("handles a line with no event: or data: prefix (no-op path in parseSseLine)", async () => {
      // Covers line 28 in parseSseLine: line is neither event: nor data: → returns unchanged
      const chunks = [
        "comment: this is ignored\nevent: done\ndata: {\"summary\": \"ok\"}\n\n",
      ]
      mockFetchOk(chunks)
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))

      await act(async () => {
        result.current.startStreamWithPost("/api/v1/ai/chat", { prompt: "test" })
        await new Promise((r) => setTimeout(r, 80))
      })

      expect(onDone).toHaveBeenCalledWith("ok")
    })
  })
})
