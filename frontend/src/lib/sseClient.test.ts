import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createSseConnection } from "./sseClient"
import type { SseHandlers } from "./sseClient"

// Track the most recently created mock EventSource instance
let latestInstance: MockEventSource

class MockEventSource {
  url: string
  listeners: Map<string, ((e: Event) => void)[]> = new Map()
  closed = false

  constructor(url: string) {
    this.url = url
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    latestInstance = this
  }

  addEventListener(type: string, handler: (e: Event) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(handler)
  }

  close() {
    this.closed = true
  }

  emit(type: string, eventData: Record<string, unknown>) {
    const handlers = this.listeners.get(type) ?? []
    for (const handler of handlers) {
      handler(eventData as unknown as Event)
    }
  }
}

beforeEach(() => {
  vi.stubGlobal("EventSource", MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeHandlers(): SseHandlers {
  return {
    onToken: vi.fn(),
    onPatch: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  }
}

describe("createSseConnection", () => {
  it("creates an EventSource with the given URL", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)
    expect(latestInstance.url).toBe("/api/sse/stream")
  })

  it("calls onToken handler when token event fires", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)

    latestInstance.emit("token", { data: JSON.stringify({ token: "abc" }) })

    expect(handlers.onToken).toHaveBeenCalledWith({ token: "abc" })
  })

  it("calls onPatch handler when patch event fires", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)

    const patch = { sectionId: "work", itemIndex: 0, field: "title", newValue: "Engineer" }
    latestInstance.emit("patch", { data: JSON.stringify(patch) })

    expect(handlers.onPatch).toHaveBeenCalledWith(patch)
  })

  it("calls onDone handler and closes connection when done event fires", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)

    latestInstance.emit("done", { data: JSON.stringify({ summary: "Done!" }) })

    expect(handlers.onDone).toHaveBeenCalledWith({ summary: "Done!" })
    expect(latestInstance.closed).toBe(true)
  })

  it("calls onError with parsed data when error event has data", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)

    latestInstance.emit("error", { data: JSON.stringify({ detail: "Stream error" }) })

    expect(handlers.onError).toHaveBeenCalledWith({ detail: "Stream error" })
    expect(latestInstance.closed).toBe(true)
  })

  it("calls onError with fallback message when error event has no data", () => {
    const handlers = makeHandlers()
    createSseConnection("/api/sse/stream", handlers)

    // Emit error event without data property (simulate a connection-level error)
    latestInstance.emit("error", {})

    expect(handlers.onError).toHaveBeenCalledWith({ detail: "SSE connection error" })
    expect(latestInstance.closed).toBe(true)
  })

  it("returns a cleanup function that closes the EventSource", () => {
    const handlers = makeHandlers()
    const cleanup = createSseConnection("/api/sse/stream", handlers)

    expect(latestInstance.closed).toBe(false)
    cleanup()
    expect(latestInstance.closed).toBe(true)
  })
})
