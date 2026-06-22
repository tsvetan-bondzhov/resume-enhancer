import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TailorJobDialog from "./TailorJobDialog"

// Mock useChatStore so isStreaming defaults to false
vi.mock("@/stores/useChatStore", () => ({
  useChatStore: (selector: (state: { isStreaming: boolean }) => unknown) =>
    selector({ isStreaming: false }),
}))

describe("TailorJobDialog", () => {
  const mockStartTailorStream = vi.fn()
  const mockOnClose = vi.fn()

  const defaultProps = {
    open: true,
    resumeId: "resume-123",
    onClose: mockOnClose,
    startTailorStream: mockStartTailorStream,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders when open with textarea and action buttons", () => {
    render(<TailorJobDialog {...defaultProps} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Tailor Resume to Job")).toBeInTheDocument()
    expect(screen.getByLabelText("Job Description")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tailor Resume" })).toBeInTheDocument()
  })

  it("shows validation error when submitting empty textarea", () => {
    render(<TailorJobDialog {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: "Tailor Resume" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Job description is required")
    expect(mockStartTailorStream).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it("calls startTailorStream and onClose on valid submission", () => {
    render(<TailorJobDialog {...defaultProps} conversationId="conv-test-id" />)

    const textarea = screen.getByLabelText("Job Description")
    fireEvent.change(textarea, { target: { value: "Senior Java Developer at Acme" } })
    fireEvent.click(screen.getByRole("button", { name: "Tailor Resume" }))

    expect(mockOnClose).toHaveBeenCalledOnce()
    expect(mockStartTailorStream).toHaveBeenCalledWith(
      "resume-123",
      "Senior Java Developer at Acme",
      "conv-test-id"
    )
  })

  it("calls onClose when Cancel button is clicked", () => {
    render(<TailorJobDialog {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(mockOnClose).toHaveBeenCalledOnce()
    expect(mockStartTailorStream).not.toHaveBeenCalled()
  })

  it("job description textarea receives focus when dialog opens (AC2 — autoFocus)", () => {
    render(<TailorJobDialog {...defaultProps} />)
    const textarea = screen.getByLabelText("Job Description")
    // React 19 + jsdom: autoFocus focuses the element rather than setting the HTML attribute
    expect(textarea).toHaveFocus()
  })

  it("clears validation error when user types after an empty submit", () => {
    render(<TailorJobDialog {...defaultProps} />)

    // Trigger validation error
    fireEvent.click(screen.getByRole("button", { name: "Tailor Resume" }))
    expect(screen.getByRole("alert")).toBeInTheDocument()

    // Type something — error should clear
    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "Backend role" },
    })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
