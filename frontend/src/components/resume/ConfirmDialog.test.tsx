import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ConfirmDialog from "./ConfirmDialog"

describe("ConfirmDialog", () => {
  it("renders title and description when open (AC4)", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Resume"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText("Delete Resume")).toBeInTheDocument()
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument()
  })

  it("calls onConfirm when Confirm button clicked (AC4)", () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Are you sure?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("calls onCancel when Cancel button clicked (AC4)", () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
  })

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Revert"
        description="Revert to original?"
        confirmLabel="Revert"
        cancelLabel="Keep Changes"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /keep changes/i })).toBeInTheDocument()
  })
})
