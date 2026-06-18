import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStreamingChat } from "./useStreamingChat"
import { useChatStore } from "@/stores/useChatStore"
import { useResumeStore } from "@/stores/useResumeStore"
import * as sseModule from "@/lib/sseClient"

// Mock sseClient so we control what events fire
vi.mock("@/lib/sseClient")

describe("useStreamingChat", () => {
  let capturedHandlers: Parameters<typeof sseModule.createSseConnection>[1]

  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false })
    // Reset applyPatch to a spy
    vi.spyOn(useResumeStore.getState(), "applyPatch")

    vi.mocked(sseModule.createSseConnection).mockImplementation((_url, handlers) => {
      capturedHandlers = handlers
      return vi.fn() // cleanup fn
    })
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
})
