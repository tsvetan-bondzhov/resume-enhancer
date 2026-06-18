import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStreamingChat } from "./useStreamingChat"
import { useChatStore } from "@/stores/useChatStore"
import { useResumeStore } from "@/stores/useResumeStore"
import { useDiffStore } from "@/stores/useDiffStore"
import { useAuthStore } from "@/stores/useAuthStore"
import * as sseModule from "@/lib/sseClient"

// Mock sseClient so we control what events fire
vi.mock("@/lib/sseClient")

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
      expect(useChatStore.getState().messages).toHaveLength(1)
      expect(useChatStore.getState().messages[0].role).toBe("assistant")
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

      expect(useChatStore.getState().messages[0].content).toBe("Enhanced")
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
  })
})
