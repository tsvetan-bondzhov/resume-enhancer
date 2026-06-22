import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useChatStore } from "@/stores/useChatStore"
import AIActionBar from "./AIActionBar"

// Mock useStreamingChat — control startEnhanceStream behaviour per test
const mockStartEnhanceStream = vi.fn()
let capturedOptions: {
  onDone?: () => void
  onError?: (detail: string) => void
} = {}

vi.mock("@/hooks/useStreamingChat", () => ({
  useStreamingChat: (options: { onDone?: () => void; onError?: (detail: string) => void } = {}) => {
    capturedOptions = options
    return {
      startEnhanceStream: mockStartEnhanceStream,
      startStream: vi.fn(),
      startStreamWithPost: vi.fn(),
    }
  },
}))

describe("AIActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = {}
    mockStartEnhanceStream.mockReturnValue(() => {})
    useChatStore.setState({ messages: [], isStreaming: false })
  })

  it("renders the Enhance button", () => {
    render(<AIActionBar resumeId="resume-123" />)
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument()
  })

  it("Enhance button is enabled when resumeId is provided and not streaming", () => {
    render(<AIActionBar resumeId="resume-123" />)
    expect(screen.getByRole("button", { name: /enhance/i })).not.toBeDisabled()
  })

  it("Enhance button is disabled when resumeId is undefined", () => {
    render(<AIActionBar resumeId={undefined} />)
    expect(screen.getByRole("button", { name: /enhance/i })).toBeDisabled()
  })

  it("Enhance button is disabled while streaming", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<AIActionBar resumeId="resume-123" />)
    expect(screen.getByRole("button", { name: /enhance/i })).toBeDisabled()
  })

  it("clicking Enhance calls startEnhanceStream with the resumeId", () => {
    render(<AIActionBar resumeId="resume-abc" />)
    fireEvent.click(screen.getByRole("button", { name: /enhance/i }))
    expect(mockStartEnhanceStream).toHaveBeenCalledWith("resume-abc")
  })

  it("does not call startEnhanceStream when resumeId is undefined", () => {
    render(<AIActionBar resumeId={undefined} />)
    fireEvent.click(screen.getByRole("button", { name: /enhance/i }))
    expect(mockStartEnhanceStream).not.toHaveBeenCalled()
  })

  it("does not call startEnhanceStream when already streaming", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<AIActionBar resumeId="resume-abc" />)
    fireEvent.click(screen.getByRole("button", { name: /enhance/i }))
    expect(mockStartEnhanceStream).not.toHaveBeenCalled()
  })

  it("shows the pulse indicator when streaming", () => {
    act(() => {
      useChatStore.setState({ isStreaming: true })
    })
    render(<AIActionBar resumeId="resume-123" />)
    // The pulse span is aria-hidden but it exists in the DOM
    const pulseEl = document.querySelector(String.raw`.motion-safe\:animate-pulse`)
    expect(pulseEl).toBeInTheDocument()
  })

  it("does not show the pulse indicator when not streaming", () => {
    render(<AIActionBar resumeId="resume-123" />)
    const pulseEl = document.querySelector(String.raw`.motion-safe\:animate-pulse`)
    expect(pulseEl).not.toBeInTheDocument()
  })

  it("shows error message when onError callback is invoked", () => {
    render(<AIActionBar resumeId="resume-123" />)
    act(() => {
      capturedOptions.onError?.("Enhancement failed")
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Enhancement failed")).toBeInTheDocument()
  })

  it("clears error message when onDone callback is invoked", () => {
    render(<AIActionBar resumeId="resume-123" />)

    // First set an error
    act(() => {
      capturedOptions.onError?.("Something went wrong")
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()

    // Then call onDone
    act(() => {
      capturedOptions.onDone?.()
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("clears error message when Enhance is clicked again", () => {
    render(<AIActionBar resumeId="resume-123" />)

    // Trigger an error
    act(() => {
      capturedOptions.onError?.("Previous error")
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()

    // Click Enhance again
    fireEvent.click(screen.getByRole("button", { name: /enhance/i }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("does not render error paragraph when errorMessage is null", () => {
    render(<AIActionBar resumeId="resume-123" />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
