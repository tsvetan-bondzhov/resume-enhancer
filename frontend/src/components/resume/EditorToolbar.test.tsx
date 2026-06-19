import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import EditorToolbar from "./EditorToolbar"

function buildProps(overrides?: Partial<Parameters<typeof EditorToolbar>[0]>) {
  return {
    resumeName: "My Resume",
    autosaveStatus: "idle" as const,
    isDirty: false,
    lastSavedAt: null,
    isSavingAs: false,
    isExporting: false,
    onNameChange: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onBack: vi.fn(),
    onExportPdf: vi.fn(),
    ...overrides,
  }
}

describe("EditorToolbar — formatSavedAgo (lines 18-21)", () => {
  it("shows 'just now' when lastSavedAt is less than 1 minute ago", () => {
    const recent = new Date(Date.now() - 30_000) // 30 seconds ago
    render(<EditorToolbar {...buildProps({ lastSavedAt: recent, isDirty: false })} />)
    expect(screen.getByRole("button", { name: /Saved just now/i })).toBeInTheDocument()
  })

  it("shows '1 min ago' when lastSavedAt is exactly 1 minute ago", () => {
    const oneMinAgo = new Date(Date.now() - 60_000)
    render(<EditorToolbar {...buildProps({ lastSavedAt: oneMinAgo, isDirty: false })} />)
    expect(screen.getByRole("button", { name: /Saved 1 min ago/i })).toBeInTheDocument()
  })

  it("shows 'N min ago' when lastSavedAt is multiple minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
    render(<EditorToolbar {...buildProps({ lastSavedAt: fiveMinAgo, isDirty: false })} />)
    expect(screen.getByRole("button", { name: /Saved 5 min ago/i })).toBeInTheDocument()
  })
})

describe("EditorToolbar — handleNameBlur (lines 62-73)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows name error and does not call onNameChange when name is blank on blur", async () => {
    const onNameChange = vi.fn()
    render(<EditorToolbar {...buildProps({ resumeName: "My Resume", onNameChange })} />)

    const input = screen.getByRole("textbox", { name: /Resume name/i })

    // Clear the input and blur
    await userEvent.clear(input)
    fireEvent.blur(input)

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required")
    expect(onNameChange).not.toHaveBeenCalled()
  })

  it("clears name error when user types after an error", async () => {
    render(<EditorToolbar {...buildProps({ resumeName: "My Resume" })} />)

    const input = screen.getByRole("textbox", { name: /Resume name/i })
    await userEvent.clear(input)
    fireEvent.blur(input)

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required")

    // Type something to clear the error
    await userEvent.type(input, "a")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("calls onNameChange when name changes on blur (lines 69-71)", async () => {
    const onNameChange = vi.fn()
    render(<EditorToolbar {...buildProps({ resumeName: "Old Name", onNameChange })} />)

    const input = screen.getByRole("textbox", { name: /Resume name/i })
    await userEvent.clear(input)
    await userEvent.type(input, "New Name")
    fireEvent.blur(input)

    expect(onNameChange).toHaveBeenCalledWith("New Name")
  })

  it("does not call onNameChange when name is unchanged on blur", async () => {
    const onNameChange = vi.fn()
    render(<EditorToolbar {...buildProps({ resumeName: "My Resume", onNameChange })} />)

    const input = screen.getByRole("textbox", { name: /Resume name/i })
    fireEvent.focus(input)
    fireEvent.blur(input)

    expect(onNameChange).not.toHaveBeenCalled()
  })
})

describe("EditorToolbar — handleNameKeyDown (lines 75-78)", () => {
  it("blurs the input when Enter is pressed", async () => {
    const onNameChange = vi.fn()
    render(<EditorToolbar {...buildProps({ resumeName: "My Resume", onNameChange })} />)

    const input = screen.getByRole("textbox", { name: /Resume name/i })
    fireEvent.focus(input)
    await userEvent.clear(input)
    await userEvent.type(input, "Updated")
    fireEvent.keyDown(input, { key: "Enter" })

    // After Enter the blur handler should fire and call onNameChange
    expect(onNameChange).toHaveBeenCalledWith("Updated")
  })
})

describe("EditorToolbar — save button state (lines 106-107)", () => {
  it("save button is enabled when not dirty and not saving (line 106-107)", () => {
    render(<EditorToolbar {...buildProps({ isDirty: false, autosaveStatus: "idle" })} />)
    const saveButton = screen.getByRole("button", { name: /Saved/i })
    expect(saveButton).not.toBeDisabled()
  })

  it("save button is disabled when autosaveStatus is saving even if dirty", () => {
    render(<EditorToolbar {...buildProps({ isDirty: true, autosaveStatus: "saving" })} />)
    const saveButton = screen.getByRole("button", { name: /Save unsaved changes/i })
    expect(saveButton).toBeDisabled()
  })

  it("save button shows blue dot indicator when isDirty", () => {
    const { container } = render(<EditorToolbar {...buildProps({ isDirty: true })} />)
    // The dirty indicator is a span with bg-blue-500
    const dirtyDot = container.querySelector(".bg-blue-500")
    expect(dirtyDot).toBeInTheDocument()
  })

  it("save button does not show blue dot when not dirty", () => {
    const { container } = render(<EditorToolbar {...buildProps({ isDirty: false })} />)
    const dirtyDot = container.querySelector(".bg-blue-500")
    expect(dirtyDot).not.toBeInTheDocument()
  })
})

describe("EditorToolbar — isSavingAs state", () => {
  it("Save As button shows 'Saving…' and is disabled when isSavingAs is true", () => {
    render(<EditorToolbar {...buildProps({ isSavingAs: true })} />)
    const saveAsButton = screen.getByRole("button", { name: /Save as new resume/i })
    expect(saveAsButton).toBeDisabled()
    expect(saveAsButton).toHaveTextContent("Saving…")
  })

  it("Save As button shows 'Save As' when isSavingAs is false", () => {
    render(<EditorToolbar {...buildProps({ isSavingAs: false })} />)
    const saveAsButton = screen.getByRole("button", { name: /Save as new resume/i })
    expect(saveAsButton).not.toBeDisabled()
    expect(saveAsButton).toHaveTextContent("Save As")
  })
})

describe("EditorToolbar — useEffect name sync (lines 43-47)", () => {
  it("syncs local name when resumeName prop changes while not editing", () => {
    const { rerender } = render(<EditorToolbar {...buildProps({ resumeName: "Original" })} />)
    const input = screen.getByRole("textbox", { name: /Resume name/i })
    expect(input).toHaveValue("Original")

    rerender(<EditorToolbar {...buildProps({ resumeName: "Updated From Parent" })} />)
    expect(input).toHaveValue("Updated From Parent")
  })
})

describe("EditorToolbar — savedLabel (line 81)", () => {
  it("shows 'Saved' when lastSavedAt is null and not dirty", () => {
    render(<EditorToolbar {...buildProps({ lastSavedAt: null, isDirty: false })} />)
    expect(screen.getByRole("button", { name: /^Saved$/i })).toBeInTheDocument()
  })
})

describe("EditorToolbar — Export PDF button (AC4, AC5)", () => {
  it("renders Export PDF button and calls onExportPdf on click", () => {
    const onExportPdf = vi.fn()
    render(<EditorToolbar {...buildProps({ isExporting: false, onExportPdf })} />)
    const btn = screen.getByRole("button", { name: /export resume as pdf/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onExportPdf).toHaveBeenCalledOnce()
  })

  it("shows 'Exporting…' and disables button when isExporting is true", () => {
    render(<EditorToolbar {...buildProps({ isExporting: true, onExportPdf: vi.fn() })} />)
    const btn = screen.getByRole("button", { name: /export resume as pdf/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent("Exporting…")
  })
})
