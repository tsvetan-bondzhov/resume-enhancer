import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { useChatStore } from "@/stores/useChatStore"
import { useAuthStore } from "@/stores/useAuthStore"
import AiTestPage from "./AiTestPage"

// Stub crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid",
})

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
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      body: makeStream(chunks),
    })
  )
}

function mockFetchNotOk(status = 500, detail = "Server Error") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue({ detail }),
      body: null,
    })
  )
}

describe("AiTestPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" })
    useChatStore.setState({ messages: [], isStreaming: false })
    useAuthStore.setState({ token: null, user: null })
  })

  it("renders the page heading", () => {
    render(<AiTestPage />)
    expect(screen.getByText(/AI Streaming Spike/i)).toBeInTheDocument()
  })

  it("renders the prompt input and Send button", () => {
    render(<AiTestPage />)
    expect(screen.getByPlaceholderText(/enter a prompt/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("Send button is disabled when prompt is empty", () => {
    render(<AiTestPage />)
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("Send button is enabled when prompt has text", () => {
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello AI" },
    })
    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled()
  })

  it("renders the read-only textarea for assistant content", () => {
    render(<AiTestPage />)
    // The page has a prompt input and a read-only textarea; use getAllByRole
    const textboxes = screen.getAllByRole("textbox")
    expect(textboxes.length).toBeGreaterThanOrEqual(1)
    // The textarea is the read-only one
    const textarea = textboxes.find((el) => el.tagName.toLowerCase() === "textarea")
    expect(textarea).toBeInTheDocument()
  })

  it("shows assistant messages from chat store in the textarea", () => {
    useChatStore.setState({
      messages: [{ id: "1", role: "assistant", content: "Hello there", timestamp: "" }],
      isStreaming: false,
    })
    render(<AiTestPage />)
    const textarea = document.querySelector("textarea")!
    expect(textarea.value).toBe("Hello there")
  })

  it("shows multiple assistant messages joined by ---", () => {
    useChatStore.setState({
      messages: [
        { id: "1", role: "assistant", content: "First", timestamp: "" },
        { id: "2", role: "assistant", content: "Second", timestamp: "" },
      ],
      isStreaming: false,
    })
    render(<AiTestPage />)
    const textarea = document.querySelector("textarea")!
    expect(textarea.value).toBe("First\n---\nSecond")
  })

  it("does not show user messages in the textarea", () => {
    useChatStore.setState({
      messages: [{ id: "1", role: "user", content: "User message", timestamp: "" }],
      isStreaming: false,
    })
    render(<AiTestPage />)
    const textarea = document.querySelector("textarea")!
    expect(textarea.value).toBe("")
  })

  it("shows Streaming... button label while streaming", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({ start() {} }),
      })
    )
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /streaming/i })).toBeInTheDocument()
    )
  })

  it("disables input and button while streaming", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({ start() {} }),
      })
    )
    render(<AiTestPage />)
    const input = screen.getByPlaceholderText(/enter a prompt/i)
    fireEvent.change(input, { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    await waitFor(() => expect(input).toBeDisabled())
  })

  it("shows error message when server responds with non-ok status", async () => {
    mockFetchNotOk(500, "Internal Server Error")
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 50))
    })
    await waitFor(() =>
      expect(screen.getByText(/error:/i)).toBeInTheDocument()
    )
  })

  it("shows error message when body is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      })
    )
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 50))
    })
    await waitFor(() =>
      expect(screen.getByText(/stream unavailable/i)).toBeInTheDocument()
    )
  })

  it("shows done message after successful stream with done event", async () => {
    const chunks = [
      "event: done\ndata: {\"summary\": \"Stream complete!\"}\n\n",
    ]
    mockFetchOk(chunks)
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 100))
    })
    await waitFor(() =>
      expect(screen.getByText(/done: stream complete!/i)).toBeInTheDocument()
    )
  })

  it("appends token events to assistant message content", async () => {
    const chunks = [
      "event: token\ndata: {\"token\": \"AI \"}\n\n",
      "event: token\ndata: {\"token\": \"response\"}\n\n",
      "event: done\ndata: {\"summary\": \"ok\"}\n\n",
    ]
    mockFetchOk(chunks)
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 100))
    })
    await waitFor(() =>
      expect(screen.getByDisplayValue("AI response")).toBeInTheDocument()
    )
  })

  it("shows error when SSE error event fires", async () => {
    const chunks = [
      "event: error\ndata: {\"detail\": \"Model unavailable\"}\n\n",
    ]
    mockFetchOk(chunks)
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 100))
    })
    await waitFor(() =>
      expect(screen.getByText(/error: model unavailable/i)).toBeInTheDocument()
    )
  })

  it("uses auth token in Authorization header", async () => {
    useAuthStore.setState({ token: "my-token", user: null })
    mockFetchOk(["event: done\ndata: {\"summary\": \"ok\"}\n\n"])
    const mockFetch = vi.mocked(fetch)
    render(<AiTestPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter a prompt/i), {
      target: { value: "Hello" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send/i }))
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai/chat",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })
})
