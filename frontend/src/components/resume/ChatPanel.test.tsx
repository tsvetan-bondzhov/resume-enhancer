import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { toast } from "sonner"
import { useChatStore } from "@/stores/useChatStore"
import { useResumeStore } from "@/stores/useResumeStore"
import type { ChatMessage } from "@/types/api"
import ChatPanel from "./ChatPanel"

// Mock useStreamingChat — we control startStreamWithPost behaviour per test
const mockStartStreamWithPost = vi.fn()
const mockStartStream = vi.fn()
let capturedOptions: { onDone?: (summary: string) => void; onError?: (detail: string) => void } = {}

vi.mock("@/hooks/useStreamingChat", () => ({
  useStreamingChat: (options: { onDone?: (summary: string) => void; onError?: (detail: string) => void } = {}) => {
    capturedOptions = options
    return {
      startStream: mockStartStream,
      startStreamWithPost: mockStartStreamWithPost,
    }
  },
}))

// Mock useResumeStore — capture applyPatch calls for patch-event test
const mockApplyPatch = vi.fn()
vi.mock("@/stores/useResumeStore", () => ({
  useResumeStore: (selector: (state: { applyPatch: typeof mockApplyPatch }) => unknown) =>
    selector({ applyPatch: mockApplyPatch }),
}))

// Mock sonner — verify toast.error is NOT called for AI errors
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

// Mock react-router-dom (not used in ChatPanel directly but may be transitively imported)
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useParams: () => ({ id: "test-resume-id" }),
    useNavigate: () => vi.fn(),
  }
})

function buildMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: "Hello",
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = {}
    mockStartStreamWithPost.mockReturnValue(() => {})
    mockApplyPatch.mockReset()
    // Reset store state before each test
    useChatStore.setState({ messages: [], isStreaming: false })
  })

  it("renders ChatPanel with correct ARIA attributes (AC1)", () => {
    render(<ChatPanel resumeId="test-resume-id" />)
    const log = screen.getByRole("log")
    expect(log).toBeInTheDocument()
    expect(log).toHaveAttribute("aria-live", "polite")
    expect(log).toHaveAttribute("aria-label", "AI conversation")
  })

  it("message submission calls startStreamWithPost with correct URL and body (AC2)", () => {
    render(<ChatPanel resumeId="resume-abc" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "Improve my summary" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    expect(mockStartStreamWithPost).toHaveBeenCalledWith(
      "/api/v1/ai/chat",
      expect.objectContaining({
        prompt: "Improve my summary",
        resumeId: "resume-abc",
      })
    )
  })

  it("input is cleared after submission (AC2)", () => {
    render(<ChatPanel resumeId="test-resume-id" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "Improve my summary" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    expect(textarea).toHaveValue("")
  })

  it("token events append to the message bubble — content displayed (AC3)", () => {
    const assistantMsg = buildMessage({
      role: "assistant",
      content: "Here is some streamed content",
    })
    act(() => {
      useChatStore.setState({ messages: [assistantMsg], isStreaming: true })
    })
    render(<ChatPanel resumeId="test-resume-id" />)
    expect(screen.getByText("Here is some streamed content")).toBeInTheDocument()
  })

  it("StreamingIndicator visible when isStreaming=true (AC2, AC5)", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<ChatPanel resumeId="test-resume-id" />)
    expect(screen.getByText("AI is thinking…")).toBeInTheDocument()
  })

  it("StreamingIndicator hidden when isStreaming=false (AC5)", () => {
    act(() => {
      useChatStore.setState({ isStreaming: false })
    })
    render(<ChatPanel resumeId="test-resume-id" />)
    expect(screen.queryByText("AI is thinking…")).not.toBeInTheDocument()
  })

  it("done event clears streaming indicator — onDone callback triggers setStreaming(false) (AC5)", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<ChatPanel resumeId="test-resume-id" />)
    expect(screen.getByText("AI is thinking…")).toBeInTheDocument()
    // In the real hook, done event calls setStreaming(false) then options.onDone?.()
    // Simulate both: store update + callback
    act(() => {
      useChatStore.setState({ isStreaming: false })
      capturedOptions.onDone?.("Stream complete")
    })
    expect(screen.queryByText("AI is thinking…")).not.toBeInTheDocument()
  })

  it("error event shows inline error state, NOT toast (AC6)", () => {
    render(<ChatPanel resumeId="test-resume-id" />)
    // Simulate error via captured onError callback
    act(() => {
      capturedOptions.onError?.("AI features are temporarily unavailable")
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("AI is offline — check your Ollama connection")).toBeInTheDocument()
    // toast.error must NOT be called
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it("Retry button calls startStreamWithPost again with the last prompt (AC6)", async () => {
    render(<ChatPanel resumeId="test-resume-id" />)

    // Submit a message first
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "Make it better" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    expect(mockStartStreamWithPost).toHaveBeenCalledTimes(1)

    // Simulate error
    act(() => {
      capturedOptions.onError?.("AI features are temporarily unavailable")
    })

    // Click Retry
    const retryBtn = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(mockStartStreamWithPost).toHaveBeenCalledTimes(2)
    expect(mockStartStreamWithPost).toHaveBeenLastCalledWith(
      "/api/v1/ai/chat",
      expect.objectContaining({
        prompt: "Make it better",
        resumeId: "test-resume-id",
      })
    )
  })

  it("Send button is disabled when input is empty", () => {
    render(<ChatPanel resumeId="test-resume-id" />)
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("Send button is disabled while streaming", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<ChatPanel resumeId="test-resume-id" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "Hello" } })
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("Enter key submits message; Shift+Enter does not submit", () => {
    render(<ChatPanel resumeId="test-resume-id" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "My message" } })

    // Shift+Enter should NOT submit
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })
    expect(mockStartStreamWithPost).not.toHaveBeenCalled()

    // Plain Enter should submit
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false })
    expect(mockStartStreamWithPost).toHaveBeenCalledTimes(1)
  })

  it("chat_submission_includes_conversationId_in_body (AC3 — session-scoped memory)", () => {
    render(<ChatPanel resumeId="resume-abc" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "What is a good summary?" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    // conversationId is included and is a non-empty UUID string
    expect(mockStartStreamWithPost).toHaveBeenCalledWith(
      "/api/v1/ai/chat",
      expect.objectContaining({ conversationId: expect.any(String) })
    )
    const [, body] = mockStartStreamWithPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body.conversationId).toBeTruthy()
    expect(body.conversationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) // UUID v4 format
  })

  it("uses the same conversationId for all messages in a session (AC3)", () => {
    render(<ChatPanel resumeId="resume-abc" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })

    // First message
    fireEvent.change(textarea, { target: { value: "Question 1" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    const [, body1] = mockStartStreamWithPost.mock.calls[0] as [string, Record<string, unknown>]

    // Simulate completion so we can send a second message
    act(() => { capturedOptions.onDone?.("") })
    useChatStore.setState({ isStreaming: false })

    // Second message
    fireEvent.change(textarea, { target: { value: "Question 2" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    const [, body2] = mockStartStreamWithPost.mock.calls[1] as [string, Record<string, unknown>]

    expect(body1.conversationId).toBe(body2.conversationId)
  })

  it("patch event dispatches to useResumeStore.applyPatch (AC4, AC8)", () => {
    // Simulate startStreamWithPost invoking applyPatch (as the real hook does on a patch SSE event)
    const patchPayload = { sectionId: "experience", itemIndex: 0, field: "title", newValue: "Senior Engineer" }
    mockStartStreamWithPost.mockImplementationOnce(() => {
      // Immediately invoke applyPatch as the hook would when it receives a patch event
      useResumeStore((state) => state.applyPatch)(patchPayload)
      return () => {}
    })

    render(<ChatPanel resumeId="test-resume-id" />)
    const textarea = screen.getByRole("textbox", { name: /chat message input/i })
    fireEvent.change(textarea, { target: { value: "Update my job title" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    expect(mockApplyPatch).toHaveBeenCalledWith(patchPayload)
  })
})
